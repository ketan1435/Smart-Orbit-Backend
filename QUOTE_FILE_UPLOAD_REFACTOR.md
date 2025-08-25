# Quote API File Upload Refactor

## Overview

The Quote API has been refactored to properly handle file uploads according to the FILE_UPLOAD_GUIDELINES.md. This implementation follows the two-phase, decoupled upload process using S3 Presigned URLs.

## Key Changes Made

### 1. Transactional Middleware

**File:** `src/middlewares/transactional.js`

- Created a new transactional middleware that wraps database operations
- Ensures proper transaction rollback on errors
- Provides database session to service functions
- Handles session cleanup automatically

### 2. Refactored Quote Service

**File:** `src/services/quote.service.js`

#### **Updated Functions:**
- `createQuote(quoteData, session)` - Now accepts database session
- `updateQuote(quoteId, updateData, session)` - Now accepts database session  
- `bulkCreateQuotes(bulkData, session)` - Now accepts database session

#### **File Handling Logic:**
1. **Create DB Record First** - Quote is created inside the transaction
2. **Process Files Outside Transaction** - File operations in try-catch block
3. **Copy Files to Permanent Location** - From `uploads/tmp/` to organized structure
4. **Update DB with File Locations** - Update quote with permanent file keys
5. **Cleanup Temporary Files** - Delete files from `uploads/tmp/`
6. **Compensating Actions** - Rollback file operations on failure

#### **File Organization:**
- **Quote Attachments:** `quotes/{quoteId}/attachments/{filename}`
- **Item Attachments:** `quotes/{quoteId}/items/{bomItemId}/attachments/{filename}`

### 3. Service Functions for Routes

**New Functions:**
- `createQuoteService(req, res, next, session)` - Direct route handler
- `updateQuoteService(req, res, next, session)` - Direct route handler
- `bulkCreateQuotesService(req, res, next, session)` - Direct route handler

### 4. Updated Routes

**File:** `src/routes/v1/quote.route.js`

#### **Transactional Routes:**
- `POST /quotes` - Uses `transactional(createQuoteService)`
- `PUT /quotes/:id` - Uses `transactional(updateQuoteService)`
- `POST /quotes/bulk` - Uses `transactional(bulkCreateQuotesService)`

#### **Comprehensive Swagger Documentation:**
- Detailed schema definitions for all file-related fields
- Clear examples showing file key usage (not actual files)
- Proper documentation of the two-phase upload process

## File Upload Process

### Phase 1: File Upload (Frontend)
1. Frontend calls `POST /files/initiate-upload` with file metadata
2. Backend returns presigned URL and temporary file key
3. Frontend uploads file directly to S3 using presigned URL
4. File is stored in `uploads/tmp/{fileCategory}/` location

### Phase 2: Quote Creation (Frontend)
1. Frontend submits quote data with file keys (not actual files)
2. Backend processes the request with transactional middleware
3. Files are copied from temporary to permanent locations
4. Temporary files are cleaned up
5. Quote is created/updated with permanent file references

## Error Handling

### Database Transaction Failures
- Automatic rollback of database changes
- No orphaned records created

### File Operation Failures
- Compensating actions delete successfully copied files
- Transaction rollback ensures database consistency
- Detailed error logging for debugging

### Temporary File Cleanup
- S3 Lifecycle Policy handles orphaned temporary files
- Automatic deletion after 1-2 days
- No manual cleanup required

## API Usage Examples

### Creating a Quote with Files

```javascript
// Phase 1: Upload files
const uploadResult = await initiateUpload({
  fileName: "quote-document.pdf",
  fileType: "application/pdf",
  fileCategory: "quote-documents"
});

await uploadFile(uploadResult.uploadUrl, file);

// Phase 2: Create quote with file keys
const quoteData = {
  bomId: "507f1f77bcf86cd799439011",
  projectId: "507f1f77bcf86cd799439012", 
  vendorId: "507f1f77bcf86cd799439013",
  quoteTitle: "Steel and Cement Quote",
  quoteItems: [
    {
      bomItemId: "507f1f77bcf86cd799439014",
      itemName: "Steel TMT 500D",
      availabilityStatus: "available",
      unitPrice: 45000,
      quantity: 500,
      totalPrice: 22500000,
      attachments: [
        {
          type: "product-image",
          fileKey: uploadResult.key, // Temporary file key
          fileName: "steel-image.jpg"
        }
      ]
    }
  ],
  totalAmount: 22500000,
  quoteAttachments: [
    {
      type: "quote-document", 
      fileKey: "uploads/tmp/quote-documents/quote-pdf-456.pdf",
      fileName: "quote-document.pdf"
    }
  ]
};

const response = await createQuote(quoteData);
```

## Benefits

1. **Scalability** - No file uploads through application server
2. **Reliability** - Proper transaction handling and error recovery
3. **User Experience** - Upload progress and immediate feedback
4. **Security** - Presigned URLs with expiration
5. **Maintainability** - Clean separation of concerns
6. **Consistency** - Follows established file upload patterns

## File Categories

The following file categories are supported for quote uploads:

- `quote-documents` - Quote PDFs, terms, conditions
- `quote-images` - Product images, catalog images
- `quote-catalogs` - Product catalogs, brochures
- `quote-other` - Other supporting documents

## Security Considerations

1. **File Type Validation** - Backend validates file types
2. **File Size Limits** - Configured in S3 and application
3. **Access Control** - Files are private and require authentication
4. **Temporary URLs** - Presigned URLs expire after 1 hour
5. **Organized Storage** - Files are stored in organized folder structure

## Monitoring and Logging

- All file operations are logged with appropriate levels
- Error scenarios are logged with stack traces
- File cleanup operations are logged for audit purposes
- Transaction failures are logged with context

This refactored implementation ensures robust, scalable, and secure file handling for the Quote API while maintaining data consistency and providing excellent user experience.
