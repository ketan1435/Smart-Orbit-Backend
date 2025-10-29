import ProjectWaterfall from '../models/projectWaterfall.model.js';
import Project from '../models/project.model.js';
import logger from '../config/logger.js';

/**
 * Helper function to update waterfall step status
 * @param {string} projectId - The project ID
 * @param {number} stepNo - The step number to complete
 * @param {string} performedBy - Who performed the action (user name or role)
 * @param {string} remarks - Optional remarks
 * @returns {Promise<ProjectWaterfall|null>} - The updated waterfall or null if not found
 */
export const updateWaterfallStep = async (projectId, stepNo, performedBy, remarks = '') => {
    try {
        if (!projectId) {
            logger.warn('updateWaterfallStep: No projectId provided');
            return null;
        }

        // Find or create waterfall
        let waterfall = await ProjectWaterfall.findOne({ projectId });

        if (!waterfall) {
            // Get project to create waterfall with correct name
            const project = await Project.findById(projectId);
            if (!project) {
                logger.warn(`updateWaterfallStep: Project not found for projectId: ${projectId}`);
                return null;
            }

            // Create new waterfall
            waterfall = new ProjectWaterfall({
                projectId,
                projectName: project.projectName || 'Untitled Project',
                currentStepNumber: stepNo, // Start at the step being completed
            });
            // Steps will be auto-initialized by pre-save middleware
            await waterfall.save();
            logger.info(`Created new waterfall for project ${projectId} at step ${stepNo}`);
        }

        // Find the step to update
        const step = waterfall.steps.find(s => s.stepNo === stepNo);
        if (!step) {
            logger.warn(`updateWaterfallStep: Step ${stepNo} not found in waterfall for project ${projectId}`);
            return waterfall;
        }

        // Only update if step is not already completed
        if (step.status !== 'completed') {
            step.status = 'completed';
            step.completedAt = new Date();
            step.completedBy = performedBy;
            step.history.push({
                timestamp: new Date(),
                performedBy,
                action: 'completed',
                remarks: remarks || `Step ${stepNo} completed`
            });

            // Update currentStepNumber if this step is >= current step
            if (stepNo >= waterfall.currentStepNumber) {
                // Find the next pending step (sort by stepNo to ensure correct order)
                const nextSteps = waterfall.steps
                    .filter(s => s.stepNo > stepNo && s.status === 'pending')
                    .sort((a, b) => a.stepNo - b.stepNo);

                const nextStep = nextSteps[0]; // Get the immediate next step

                if (nextStep) {
                    waterfall.currentStepNumber = nextStep.stepNo;
                    nextStep.status = 'active';
                    nextStep.history.push({
                        timestamp: new Date(),
                        performedBy,
                        action: 'activated',
                        remarks: `Activated after step ${stepNo} completion`
                    });
                } else {
                    // No more pending steps, stay at current completed step
                    waterfall.currentStepNumber = stepNo;
                }
            }

            await waterfall.save();
            logger.info(`Updated waterfall step ${stepNo} for project ${projectId}`);
        } else {
            logger.debug(`Waterfall step ${stepNo} already completed for project ${projectId}`);
        }

        return waterfall;
    } catch (error) {
        logger.error(`Error updating waterfall step ${stepNo} for project ${projectId}:`, error);
        // Don't throw - waterfall updates shouldn't break main flow
        return null;
    }
};

/**
 * Helper to ensure waterfall exists and is at least at specified step
 * @param {string} projectId - The project ID
 * @param {number} minStepNo - Minimum step number (will create/advance if needed)
 * @param {string} performedBy - Who performed the action
 * @returns {Promise<ProjectWaterfall|null>}
 */
export const ensureWaterfallAtStep = async (projectId, minStepNo, performedBy) => {
    try {
        let waterfall = await ProjectWaterfall.findOne({ projectId });

        if (!waterfall) {
            const project = await Project.findById(projectId);
            if (!project) {
                return null;
            }

            waterfall = new ProjectWaterfall({
                projectId,
                projectName: project.projectName || 'Untitled Project',
                currentStepNumber: minStepNo,
            });
            await waterfall.save();

            // Mark all steps before minStepNo as completed
            for (let i = 1; i < minStepNo; i++) {
                const step = waterfall.steps.find(s => s.stepNo === i);
                if (step) {
                    step.status = 'completed';
                    step.completedAt = new Date();
                    step.completedBy = performedBy;
                }
            }

            // Mark minStepNo as active or completed
            const minStep = waterfall.steps.find(s => s.stepNo === minStepNo);
            if (minStep) {
                minStep.status = 'active';
            }

            await waterfall.save();
            return waterfall;
        }

        // If current step is less than minStepNo, advance it
        if (waterfall.currentStepNumber < minStepNo) {
            waterfall.currentStepNumber = minStepNo;
            const minStep = waterfall.steps.find(s => s.stepNo === minStepNo);
            if (minStep && minStep.status === 'pending') {
                minStep.status = 'active';
            }
            await waterfall.save();
        }

        return waterfall;
    } catch (error) {
        logger.error(`Error ensuring waterfall at step ${minStepNo} for project ${projectId}:`, error);
        return null;
    }
};

