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
                timeout: 30000,
                launchOptions: {
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                }
            }));

        await jsreportInstance.init();
    }
    return jsreportInstance;
};

const buildHtml = (clientProposal, formatDate) => {
    const section = (title, content) =>
        content ? `
      <div class="section">
        <h2>${title}</h2>
        <div>${decode(content)}</div>
      </div>` : '';

    return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body {
        font-family: 'Times New Roman', serif;
        font-size: 12pt;
        color: #222;
        margin: 1in 0.75in;
        line-height: 1.5;
      }
      h1, h2 {
        font-weight: bold;
        margin-top: 24px;
        margin-bottom: 8px;
      }
      h2 {
        font-size: 14pt;
      }
      .company-header {
        text-align: center;
        margin-bottom: 30px;
      }
      .company-address {
        font-size: 10pt;
        line-height: 1.2;
        margin: 0;
      }
      .proposal-title {
        text-align: center;
        margin-top: 20px;
        font-size: 14pt;
      }
      .project-details {
        margin-top: 15px;
        font-size: 10pt;
        line-height: 1.3;
      }
      .key-highlights {
        margin-top: 15px;
      }
      .key-highlights li {
        margin: 8px 0;
      }
      .key-highlights i {
        color: #2c3e50;
        margin-right: 8px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
      }
      th, td {
        border: 1px solid #ccc;
        padding: 6px 8px;
        text-align: left;
      }
      th {
        background-color: #f2f2f2;
        font-weight: bold;
      }
      .page-break {
        page-break-after: always;
        height: 20px;
      }
      .footer-info {
        margin-top: 30px;
        font-size: 8pt;
        line-height: 1.2;
      }
      .footer-info > div {
        margin-bottom: 6px;
      }
    </style>
  </head>
  <body>

    <div class="company-header">
      <img src="data:image/png;base64,${clientProposal.logoBase64}" 
           style="height: 50px; margin-bottom: 10px;" />
      <div class="company-address">
        Flat No:.405, A Wing, Pavani Park, Chakan Talegoan Road, Kharabwadi, Pune Maharashtra 410501, India<br />
        Contact No:. +91 70 5361 5361 & +91 9325396912<br />
        Email Id:. info@mobico.co.in
      </div>
    </div>

    <h1 class="proposal-title">Proposal for ${clientProposal.proposalFor || 'N/A'}</h1>

    <div class="project-details">
      <div><strong>Project Location:</strong> ${clientProposal.projectLocation}</div>
      <div><strong>Project Type:</strong> ${clientProposal.projectType}</div>
      <div><strong>Unit Cost:</strong> ₹${clientProposal.unitCost} (Excluding GST)</div>
      <div><strong>Manufacturing & Supply by:</strong> Smart Orbiters, Pune</div>
    </div>

    ${section('1. Project Overview', clientProposal.projectOverview)}
    ${section('2. Cottage Specifications', clientProposal.cottageSpecifications)}
    ${section('3. Material Details', clientProposal.materialDetails)}
    ${section('4. Key Durability Features', clientProposal.salesTerms)}
    ${section('5. Additional Features', clientProposal.contactInformation)}
    ${section('6. Cost Breakdown', clientProposal.costBreakdown)}
    ${section('7. Payment Terms', clientProposal.paymentTerms)}
    ${section('8. Sales Terms & Conditions', clientProposal.salesTerms)}

    <div class="footer-info">
      <div>EMAIL: info@mobico.co.in, www.mobico.co.in</div>
      <div>Contact No: +91 70 5361 5361  +91 9325396912</div>
      <div>Udyog Adhaar Number: MH26A0254417</div>
      <div>Import Export Code: ADPPH4467G</div>
    </div>

    <div class="page-break"></div>

    <div class="meta-info">
      <h2>Meta Information</h2>
      <p><strong>Status:</strong> ${clientProposal.status}</p>
      <p><strong>Version:</strong> ${clientProposal.version}</p>
      <p><strong>Created At:</strong> ${formatDate(clientProposal.createdAt)}</p>
      <p><strong>Last Updated:</strong> ${formatDate(clientProposal.updatedAt)}</p>
      <p><strong>Created By:</strong> ${clientProposal.createdBy?.name || 'N/A'}</p>
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

        const formatDate = (date) => new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const logoPath = join(__dirname, '..', '..', 'public', 'images', 'logo.png');
        const logoBase64 = await fs.readFile(logoPath, 'base64');

        const htmlTemplate = buildHtml(clientProposal, formatDate);

        const { stream } = await jsreport.render({
            template: {
                content: htmlTemplate,
                engine: 'jsrender',
                recipe: 'chrome-pdf',
                chrome: {
                    displayHeaderFooter: true,
                    marginTop: '100px',
                    marginBottom: '80px',
                    printBackground: true,
                    headerTemplate: `
<html>
<head>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
    }
    #header, body {
      padding: 0 !important;
      margin: 0 !important;
      width: 100% !important;
    }
  </style>
</head>
<body id="header">
  <div style="width:100%; display:flex; justify-content:space-between; font-family:Arial; font-size:10px; border-bottom:1px solid #ccc; padding:10px 0;">
    <img src="data:image/png;base64,{{:~logoBase64}}" style="height:40px;" />
    <div style="text-align:right;">
      <div>Flat No.405, Pavani Park, Pune 410501</div>
      <div>+91 7053615361 | +91 9325396912</div>
      <div>info@mobico.co.in</div>
    </div>
  </div>
</body>
</html>
`,

                    footerTemplate: `
<html>
<head>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
    }
    #footer, body {
      padding: 0 !important;
      margin: 0 !important;
      width: 100% !important;
    }
  </style>
</head>
<body id="footer">
  <div style="width:100%; font-family:Arial; font-size:10px; color:#777; text-align:center; border-top:1px solid #ccc; padding:8px 0;">
    © Smart Orbiters | GST: 27ADPPH4467G1Z8 | Page <span class="pageNumber"></span> of <span class="totalPages"></span>
  </div>
</body>
</html>
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

        // return result.content;
    } catch (error) {
        throw new Error(`PDF generation failed: ${error.message}`);
    }
};
