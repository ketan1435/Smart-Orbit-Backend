import jsreport from 'jsreport-core';
import jsrender from 'jsreport-jsrender';
import chromePdf from 'jsreport-chrome-pdf';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize jsreport with proper module directory
let jsreportInstance;

const initializeJsreport = async () => {
    if (!jsreportInstance) {
        jsreportInstance = jsreport({
            parentModuleDirectory: __dirname
        })
            .use(jsrender())
            .use(chromePdf({
                timeout: 30000,
                launchOptions: {
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                }
            }));

        await jsreportInstance.init();
    }
    return jsreportInstance;
};

/**
 * Generate PDF from client proposal data
 * @param {Object} clientProposal - The client proposal data
 * @returns {Promise<Buffer>} - PDF buffer
 */
export const generateClientProposalPDF = async (clientProposal) => {
    try {
        const jsreport = await initializeJsreport();

        // Format dates
        const formatDate = (date) => {
            return new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        };

        // Build HTML content dynamically to avoid template syntax issues
        const buildHtml = () => {
            let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Client Proposal</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 40px;
                    line-height: 1.6;
                    color: #333;
                }
                .header {
                    text-align: center;
                    border-bottom: 2px solid #333;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .section {
                    margin-bottom: 25px;
                }
                .section h2 {
                    color: #2c3e50;
                    border-bottom: 1px solid #bdc3c7;
                    padding-bottom: 5px;
                }
                .customer-info {
                    background-color: #f8f9fa;
                    padding: 15px;
                    border-radius: 5px;
                    margin-bottom: 20px;
                }
                .customer-info h3 {
                    margin-top: 0;
                    color: #2c3e50;
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }
                .project-details {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin-bottom: 20px;
                }
                .project-detail {
                    background-color: #ecf0f1;
                    padding: 10px;
                    border-radius: 3px;
                }
                .project-detail strong {
                    color: #2c3e50;
                }
                .content-section {
                    margin-bottom: 20px;
                }
                .content-section h3 {
                    color: #2c3e50;
                    margin-bottom: 10px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 10px 0;
                }
                table, th, td {
                    border: 1px solid #ddd;
                }
                th, td {
                    padding: 8px;
                    text-align: left;
                }
                th {
                    background-color: #f2f2f2;
                }
                .footer {
                    margin-top: 40px;
                    text-align: center;
                    font-size: 12px;
                    color: #7f8c8d;
                    border-top: 1px solid #bdc3c7;
                    padding-top: 20px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Client Proposal</h1>
                <p>Generated on ${formatDate(clientProposal.createdAt)}</p>
            </div>

            <div class="customer-info">
                <h3>Customer Information</h3>
                <div class="info-grid">
                    <div><strong>Name:</strong> ${clientProposal.customerInfo.name}</div>
                    ${clientProposal.customerInfo.email ? `<div><strong>Email:</strong> ${clientProposal.customerInfo.email}</div>` : ''}
                    ${clientProposal.customerInfo.phone ? `<div><strong>Phone:</strong> ${clientProposal.customerInfo.phone}</div>` : ''}
                    ${clientProposal.customerInfo.address ? `<div><strong>Address:</strong> ${clientProposal.customerInfo.address}</div>` : ''}
                </div>
            </div>`;

            if (clientProposal.proposalFor) {
                html += `
            <div class="section">
                <h2>Proposal Details</h2>
                <div class="project-details">
                    <div class="project-detail">
                        <strong>Proposal For:</strong><br>
                        ${clientProposal.proposalFor}
                    </div>
                    ${clientProposal.projectLocation ? `
                    <div class="project-detail">
                        <strong>Project Location:</strong><br>
                        ${clientProposal.projectLocation}
                    </div>` : ''}
                    ${clientProposal.projectType ? `
                    <div class="project-detail">
                        <strong>Project Type:</strong><br>
                        ${clientProposal.projectType}
                    </div>` : ''}
                    ${clientProposal.unitCost ? `
                    <div class="project-detail">
                        <strong>Unit Cost:</strong><br>
                        ${clientProposal.unitCost}
                    </div>` : ''}
                </div>
            </div>`;
            }

            if (clientProposal.manufacturingSupply) {
                html += `
            <div class="content-section">
                <h3>Manufacturing & Supply</h3>
                ${clientProposal.manufacturingSupply}
            </div>`;
            }

            if (clientProposal.projectOverview) {
                html += `
            <div class="content-section">
                <h3>Project Overview</h3>
                ${clientProposal.projectOverview}
            </div>`;
            }

            if (clientProposal.cottageSpecifications) {
                html += `
            <div class="content-section">
                <h3>Cottage Specifications</h3>
                ${clientProposal.cottageSpecifications}
            </div>`;
            }

            if (clientProposal.materialDetails) {
                html += `
            <div class="content-section">
                <h3>Material Details</h3>
                ${clientProposal.materialDetails}
            </div>`;
            }

            if (clientProposal.costBreakdown) {
                html += `
            <div class="content-section">
                <h3>Cost Breakdown</h3>
                ${clientProposal.costBreakdown}
            </div>`;
            }

            if (clientProposal.paymentTerms) {
                html += `
            <div class="content-section">
                <h3>Payment Terms</h3>
                ${clientProposal.paymentTerms}
            </div>`;
            }

            if (clientProposal.salesTerms) {
                html += `
            <div class="content-section">
                <h3>Sales Terms</h3>
                ${clientProposal.salesTerms}
            </div>`;
            }

            if (clientProposal.contactInformation) {
                html += `
            <div class="content-section">
                <h3>Contact Information</h3>
                ${clientProposal.contactInformation}
            </div>`;
            }

            html += `
            <div class="footer">
                <p>Proposal Status: <strong>${clientProposal.status}</strong> | Version: ${clientProposal.version}</p>
                <p>Created by: ${clientProposal.createdBy?.name || 'Unknown'} | Last updated: ${formatDate(clientProposal.updatedAt)}</p>
            </div>
        </body>
        </html>`;

            return html;
        };

        const htmlTemplate = buildHtml();

        const result = await jsreport.render({
            template: {
                content: htmlTemplate,
                engine: 'jsrender',
                recipe: 'chrome-pdf',
                chrome: {
                    format: 'A4',
                    marginTop: '1in',
                    marginBottom: '1in',
                    marginLeft: '1in',
                    marginRight: '1in',
                    printBackground: true
                }
            }
        });

        return result.content;
    } catch (error) {
        throw new Error(`PDF generation failed: ${error.message}`);
    }
}; 