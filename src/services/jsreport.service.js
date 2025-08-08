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

// Enhanced HTML entity decoding function
const decodeHtmlEntities = (html) => {
  if (!html) return '';
  try {
    return decode(html);
  } catch (error) {
    console.warn('Error decoding HTML entities:', error);
    return html;
  }
};

// Function to render rich content with proper styling
const renderRichContent = (content, isPlainText = false) => {
  if (!content) return '';

  if (isPlainText) {
    // For plain text like cottageSpecifications, preserve line breaks
    return `<div class="rich-content plain-text">${content.replace(/\n/g, '<br>')}</div>`;
  }

  // For HTML content, decode entities and wrap in rich-content div
  const decodedContent = decodeHtmlEntities(content);
  return `<div class="rich-content">${decodedContent}</div>`;
};

const buildHtml = (clientProposal, formatDate, logoBase64) => {
  const section = (title, content, isPlainText = false) =>
    content ? `
      <div class="section">
        <h2 class="section-title">${title}</h2>
        ${renderRichContent(content, isPlainText)}
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
        margin: 10px 20px 180px 20px;
        min-height: calc(100vh - 300px);
      }
      
      h1 {
        font-size: 18pt;
        font-weight: bold;
        margin: 20px 0 15px 0;
        text-align: center;
      }
      
      h2 {
        font-size: 14pt;
        font-weight: 700;
        margin: 25px 0 12px 0;
        padding-bottom: 5px;
      }
      
      .section-title {
        font-size: 14pt;
        font-weight: 700;
        margin: 25px 0 12px 0;
        padding-bottom: 5px;
      }
      
      .project-details {
padding-bottom: 20px;
        border-bottom: 1px solid #ccc;      }
      
      .project-details div {
        margin: 8px 0;
        font-size: 11pt;
      }
      
      .project-details strong {
        font-weight: bold;
        display: inline-block;
        width: 200px;
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
        padding-bottom: 20px;
        border-bottom: 1px solid #ccc;
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
      
      /* Rich Content Styles for WYSIWYG content */
      .rich-content {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        margin: 10px 0;
        font-size: 11pt;
      }
      
      .rich-content.plain-text {
        white-space: pre-line;
        line-height: 1.6;
      }
      
      .rich-content h1 {
        font-size: 16pt;
        font-weight: bold;
        margin: 15px 0 8px 0;
        color: #1a1a1a;
        border-bottom: 1px solid #e0e0e0;
        padding-bottom: 3px;
      }
      
      .rich-content h2 {
        font-size: 14pt;
        font-weight: bold;
        margin: 12px 0 6px 0;
        color: #1a1a1a;
      }
      
      .rich-content h3 {
        font-size: 12pt;
        font-weight: bold;
        margin: 10px 0 5px 0;
        color: #1a1a1a;
      }
      
      .rich-content h4 {
        font-size: 11pt;
        font-weight: bold;
        margin: 8px 0 4px 0;
        color: #1a1a1a;
      }
      
      .rich-content p {
        margin: 6px 0;
        line-height: 1.6;
      }
      
      .rich-content ul, .rich-content ol {
        margin: 8px 0;
        padding-left: 20px;
      }
      
      .rich-content li {
        margin: 3px 0;
        line-height: 1.6;
      }
      
      .rich-content ul li {
        list-style-type: disc;
      }
      
      .rich-content ol li {
        list-style-type: decimal;
      }
      
      .rich-content blockquote {
        margin: 10px 0;
        padding: 8px 12px;
        font-style: italic;
      }
      
      .rich-content table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0;
        font-size: 10pt;
      }
      
      .rich-content table th {
        background-color: #f8f9fa;
        border: 1px solid #dee2e6;
        padding: 6px 8px;
        font-weight: bold;
        text-align: left;
        color: #495057;
      }
      
      .rich-content table td {
        border: 1px solid #dee2e6;
        padding: 6px 8px;
        vertical-align: top;
      }
      
      .rich-content table tr:nth-child(even) {
        background-color: #f8f9fa;
      }
      
      .rich-content strong {
        font-weight: bold;
        color: #1a1a1a;
      }
      
      .rich-content em {
        font-style: italic;
      }
      
      .rich-content figure.table {
        margin: 10px 0;
      }
      
      .rich-content figure.table table {
        width: 100%;
        border-collapse: collapse;
      }
      
      /* Regular table styles for non-rich content */
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
          margin: 10px 40px 180px 40px;
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
        <div><strong>Unit Cost:</strong> ₹${clientProposal.unitCost || 'N/A'}</div>
        <div><strong>Manufacturing & Supply by:</strong> ${'<strong>Smart Orbiters, Pune</strong>'}</div>
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
          marginTop: '210px',
          marginBottom: '160px',
          marginLeft: '0px',
          marginRight: '0px',
          printBackground: true,
          format: 'A4',
          headerTemplate: `
                            <div style="
                              width: 100%; 
                              margin: 0; 
                              padding: 5px 20px; 
                              font-size: 14px; 
                              font-family: Arial, sans-serif; 
                              border-bottom: 1px solid #ccc; 
                              background: white;
                              display: flex;
                              flex-direction: column;
                              align-items: center;
                              justify-content: center;
                              text-align: center;
                            ">
                              ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" 
     style="height: 90px; margin-bottom: 10px; background: white;" />` : ''}
                              <div style="line-height: 1.1; color: #000; font-weight: bold;">
                                <div>Flat No. 405, A Wing, Pavani Park, Chakan Talegoan Road, Kharabwadi,</div>
                                <div>Pune, Maharashtra 410501, India</div>
                                <div>Contact No: +91 7053615361 & +91 9325396912</div>
                                <div>Email Id: info@mobico.co.in</div>
                              </div>
                            </div>
                          `,

          footerTemplate: `
                          <div style="
                            width: 100%; 
                            margin: 0; 
                            padding: 10px 20px; 
                            font-size: 12px; 
                            font-weight: bold;
                            color: #000; 
                            text-align: left; 
                            border-top: 1px solid #ccc; 
                            background: white;
                          ">
                            <div >
                              <div>
                                EMAIL: <a href="mailto:info@mobico.co.in" style="color: #6366f1; text-decoration: none;"><strong>info@mobico.co.in</strong></a>, 
                                <a href="https://www.mobico.co.in" target="_blank" style="color: #6366f1; text-decoration: none;"><strong>www.mobico.co.in</strong></a>,
                                Contact No: <strong>+91 7053615361</strong>, <strong>+91 9325396912</strong>
                              </div>
                              <div><strong>GST No:</strong> 27ADPPH4467G1Z8</div>
                              <div><strong>Udyog Aadhaar Number:</strong> MH26A0254417</div>
                              <div><strong>Import Export Code:</strong> ADPPH4467G</div>
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