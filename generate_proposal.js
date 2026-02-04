import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

function createProposal() {
    const doc = new PDFDocument({ margin: 50 });
    const outputPath = 'C:/Users/hp/.gemini/antigravity/brain/365cfc4b-593a-497d-ad9f-a03348d46170/ITR_Data_Collection_Proposal.pdf';
    doc.pipe(fs.createWriteStream(outputPath));

    // Header
    doc.fontSize(20).text('ITR Data Collection Proposal', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString()}`);
    doc.text('Subject: Secure and Efficient Data Collection for ITR Filing (AY 2025-26)');
    doc.moveDown();

    doc.text('Dear Customer,');
    doc.moveDown();
    doc.text('To ensure a smooth and accurate Income Tax Return (ITR) filing process, we have implemented a new bulk data collection system. This allows us to process your information securely and minimize manual errors.');
    doc.moveDown();

    doc.fontSize(14).text('Data Requirements & Format', { underline: true });
    doc.fontSize(12).moveDown(0.5);
    doc.text('Please prepare your file with the following columns in exact order:');
    doc.moveDown();

    // Tables are hard in PDFKit, so we'll use a list format
    const requirements = [
        { name: 'Name', desc: 'Full name as per PAN', example: 'John Doe' },
        { name: 'Mobile No', desc: '10-digit mobile number', example: '9876543210' },
        { name: 'Email ID', desc: 'Active email address', example: 'john@example.com' },
        { name: 'PAN Number', desc: '10-character Alpha-numeric', example: 'ABCDE1234F' },
        { name: 'Income Slab', desc: 'Estimated annual income', example: '5L - 10L' }
    ];

    requirements.forEach(req => {
        doc.fontSize(12).font('Helvetica-Bold').text(`${req.name}: `, { continued: true })
            .font('Helvetica').text(`${req.desc} (Ex: ${req.example})`);
        doc.moveDown(0.3);
    });

    doc.moveDown();
    doc.fontSize(14).text('Next Steps After Submission', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).list([
        'File Validation: Once you submit the CSV, our system will validate the data.',
        'Secure Invitation: You will receive a secure link via email to set your portal password.',
        'Document Upload: Through your personalized portal, you will be able to securely upload supporting documents.',
        'Final Review: Our experts will review the data and proceed with the filing.'
    ]);

    doc.moveDown();
    doc.fillColor('red').fontSize(12).text('IMPORTANT SECURITY NOTE:', { underline: true });
    doc.fillColor('black').text('Data Privacy: We prioritize your data security. Please DO NOT include passwords or highly sensitive bank credentials in the CSV file. These will be collected through our encrypted web portal in the next step.');

    doc.moveDown(2);
    doc.text('Thank you for choosing our services.', { align: 'center' });

    doc.end();
    console.log(`PDF created successfully at: ${outputPath}`);
}

createProposal();
