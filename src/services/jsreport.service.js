import jsreport from 'jsreport-core';
import jsrender from 'jsreport-jsrender';
import chromePdf from 'jsreport-chrome-pdf';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import getStream from 'get-stream';
import { decode } from 'html-entities';

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
        timeout: 60000,
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        }
      }));

    await jsreportInstance.init();
  }
  return jsreportInstance;
};

const buildHtml = (clientProposal, formatDate, logoBase64) => {
  const section = (title, content) =>
    content ? `
      <div class="section">
        <h2>${title}</h2>
        <div class="content">${decode(content)}</div>
      </div>` : '';

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <style>
      * {
        box-sizing: border-box;
      }
      
      body {
        font-family: 'Arial', sans-serif;
        font-size: 11pt;
        color: #333;
        margin: 0;
        padding: 0;
        line-height: 1.4;
      }
      
      .page-content {
        margin: 120px 40px 100px 40px;
        min-height: calc(100vh - 220px);
      }
      
      h1 {
        font-size: 18pt;
        font-weight: bold;
        margin: 20px 0 15px 0;
        text-align: center;
        color: #2c3e50;
      }
      
      h2 {
        font-size: 14pt;
        font-weight: bold;
        margin: 25px 0 12px 0;
        color: #2c3e50;
        border-bottom: 2px solid #3498db;
        padding-bottom: 5px;
      }
      
      .project-details {
        margin: 20px 0;
        background: #f8f9fa;
        padding: 15px;
        border-radius: 5px;
        border-left: 4px solid #3498db;
      }
      
      .project-details div {
        margin: 8px 0;
        font-size: 11pt;
      }
      
      .project-details strong {
        color: #2c3e50;
        font-weight: bold;
        display: inline-block;
        width: 180px;
      }
      
      .key-highlights {
        margin: 15px 0;
      }
      
      .key-highlights ul {
        list-style: none;
        padding: 0;
        margin: 10px 0;
      }
      
      .key-highlights li {
        margin: 8px 0;
        padding-left: 20px;
        position: relative;
      }
      
      .key-highlights li:before {
        content: "✓";
        position: absolute;
        left: 0;
        color: #27ae60;
        font-weight: bold;
      }
      
      .section {
        margin: 20px 0;
        page-break-inside: avoid;
      }
      
      .content {
        margin: 10px 0;
        text-align: justify;
      }
      
      .content p {
        margin: 8px 0;
      }
      
      .content ul, .content ol {
        margin: 10px 0;
        padding-left: 20px;
      }
      
      .content li {
        margin: 5px 0;
      }
      
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 15px 0;
        font-size: 10pt;
      }
      
      th, td {
        border: 1px solid #ddd;
        padding: 8px 10px;
        text-align: left;
        vertical-align: top;
      }
      
      th {
        background-color: #f2f2f2;
        font-weight: bold;
        color: #2c3e50;
      }
      
      .cost-table {
        margin: 20px 0;
        max-width: 600px;
      }
      
      .cost-table th {
        background-color: #3498db;
        color: white;
      }
      
      .footer-info {
        margin-top: 30px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 5px;
        font-size: 9pt;
        line-height: 1.3;
        color: #666;
      }
      
      .footer-info div {
        margin: 4px 0;
      }
      
      .meta-info {
        margin-top: 30px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 5px;
        page-break-before: always;
      }
      
      .meta-info h2 {
        color: #2c3e50;
        margin-top: 0;
      }
      
      .meta-info p {
        margin: 8px 0;
        font-size: 11pt;
      }
      
      .meta-info strong {
        color: #2c3e50;
        display: inline-block;
        width: 150px;
      }
      
      /* Ensure proper page breaks */
      .page-break {
        page-break-before: always;
      }
      
      /* Print-specific styles */
      @media print {
        .page-content {
          margin: 120px 40px 100px 40px;
        }
      }
    </style>
  </head>
  <body>
    <div class="page-content">
      <h1>Proposal for ${clientProposal.proposalFor || 'N/A'}</h1>

      <div class="project-details">
        <div><strong>Project Location:</strong> ${clientProposal.projectLocation || 'N/A'}</div>
        <div><strong>Project Type:</strong> ${clientProposal.projectType || 'N/A'}</div>
        <div><strong>Unit Cost:</strong> ₹${clientProposal.unitCost || 'N/A'} (Excluding GST)</div>
        <div><strong>Manufacturing & Supply by:</strong> ${clientProposal.manufacturingSupply || 'Smart Orbiters, Pune'}</div>
      </div>

      ${section('1. Project Overview', clientProposal.projectOverview)}
      ${section('2. Cottage Specifications', clientProposal.cottageSpecifications)}
      ${section('3. Material Details', clientProposal.materialDetails)}
      ${section('4. Key Durability Features', clientProposal.keyDurabilityFeatures)}
      ${section('5. Additional Features', clientProposal.additionalFeatures)}
      ${section('6. Cost Breakdown', clientProposal.costBreakdown)}
      ${section('7. Payment Terms', clientProposal.paymentTerms)}
      ${section('8. Sales Terms & Conditions', clientProposal.salesTerms)}
      ${section('9. Contact Information', clientProposal.contactInformation)}

      <div class="footer-info">
        <div><strong>EMAIL:</strong> info@mobico.co.in, www.mobico.co.in</div>
        <div><strong>Contact No:</strong> +91 70 5361 5361 & +91 9325396912</div>
        <div><strong>Udyog Adhaar Number:</strong> MH26A0254417</div>
        <div><strong>Import Export Code:</strong> ADPPH4467G</div>
      </div>
    </div>

    <div class="page-break">
      <div class="page-content">
        <div class="meta-info">
          <h2>Meta Information</h2>
          <p><strong>Status:</strong> ${clientProposal.status || 'N/A'}</p>
          <p><strong>Version:</strong> ${clientProposal.version || 'N/A'}</p>
          <p><strong>Created At:</strong> ${formatDate(clientProposal.createdAt)}</p>
          <p><strong>Last Updated:</strong> ${formatDate(clientProposal.updatedAt)}</p>
          <p><strong>Created By:</strong> ${clientProposal.createdBy?.name || 'N/A'}</p>
          <p><strong>Customer Name:</strong> ${clientProposal.customerInfo?.name || 'N/A'}</p>
          <p><strong>Customer Email:</strong> ${clientProposal.customerInfo?.email || 'N/A'}</p>
          <p><strong>Customer Phone:</strong> ${clientProposal.customerInfo?.phone || 'N/A'}</p>
        </div>
      </div>
    </div>
  </body>
  </html>`;
};

/**
 * Generate PDF from client proposal data
 * @param {Object} clientProposal - The client proposal data
 * @returns {Promise<Buffer>} - PDF buffer
 */
export const generateClientProposalPDF = async (clientProposal) => {
  try {
    const jsreport = await initializeJsreport();

    const formatDate = (date) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    // Try to read logo, fallback to empty string if not found
    let logoBase64 = '';
    try {
      const logoPath = join(__dirname, '..', '..', 'public', 'images', 'logo.png');
      logoBase64 = await fs.readFile(logoPath, 'base64');
    } catch (error) {
      console.warn('Logo file not found, continuing without logo');
    }

    const htmlTemplate = buildHtml(clientProposal, formatDate, logoBase64);

    const { stream } = await jsreport.render({
      template: {
        content: htmlTemplate,
        engine: 'jsrender',
        recipe: 'chrome-pdf',
        chrome: {
          displayHeaderFooter: true,
          marginTop: '100px',
          marginBottom: '80px',
          marginLeft: '0px',
          marginRight: '0px',
          printBackground: true,
          format: 'A4',
          headerTemplate: `
                        <div style="width: 100%; margin: 0; padding: 15px 40px; font-size: 10px; font-family: Arial, sans-serif; border-bottom: 1px solid #ccc; display: flex; justify-content: space-between; align-items: center; background: white;">
                            <div style="display: flex; align-items: center;">
                                ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" style="height: 40px; margin-right: 15px;" />` : ''}
                                <div style="color: #2c3e50; font-weight: bold; font-size: 14px;">Smart Orbiters</div>
                            </div>
                            <div style="text-align: right; line-height: 1.2; color: #666;">
                                <div style="font-size: 9px;">Flat No.405, Pavani Park, Pune 410501</div>
                                <div style="font-size: 9px;">+91 7053615361 | +91 9325396912</div>
                                <div style="font-size: 9px;">info@mobico.co.in</div>
                            </div>
                        </div>
                    `,
          footerTemplate: `
                        <div style="width: 100%; margin: 0; padding: 10px 40px; font-size: 9px; font-family: Arial, sans-serif; color: #666; text-align: center; border-top: 1px solid #ccc; background: white;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>© Smart Orbiters | GST: 27ADPPH4467G1Z8</div>
                                <div>Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
                            </div>
                        </div>
                    `
        }
      },
      data: {
        ...clientProposal,
        logoBase64
      }
    });

    const buffer = await getStream.buffer(stream);
    return buffer;

  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error(`PDF generation failed: ${error.message}`);
  }
};