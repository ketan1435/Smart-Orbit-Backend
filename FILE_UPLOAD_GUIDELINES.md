# Architectural Guidelines for Creating POST Routes with File Uploads

This document outlines the standard architecture for creating `POST` endpoints that involve file uploads. Following this guide ensures that our application remains secure, scalable, robust, and provides a good user experience.

## Core Philosophy: Decoupled Uploads

We **do not** send files directly to our application server in form submissions. This approach does not scale, handles errors poorly, and provides no upload progress to the user.

Our architecture is a **two-phase, decoupled process** that uses **S3 Presigned URLs**.

1.  **Phase 1: Get Permission & Upload Directly to S3.** The frontend first asks our server for a secure, one-time URL. It then uses this URL to upload the file directly to a temporary location in S3. Our server is not involved in the heavy lifting of the upload itself.
2.  **Phase 2: Submit Form with File Reference.** Once the upload is complete, the frontend submits the main form data. Instead of a file, it includes a unique `key` that references the already-uploaded file in S3.

---

## Step-by-Step Implementation Guide

### 1. The Generic "Initiate Upload" Endpoint

All file uploads, regardless of the context (customer leads, user avatars, etc.), must use the central, generic endpoint for getting a presigned URL.

-   **Endpoint:** `POST /api/v1/files/initiate-upload`
-   **Authentication:** This route **must** be protected by the `auth()` middleware.
-   **Request Body:**
    ```json
    {
      "fileName": "project-video.mp4",
      "fileType": "video/mp4",
      "fileCategory": "customer-videos" 
    }
    ```
-   **`fileCategory`:** This is a generic string (e.g., `user-avatars`, `project-documents`) that will be used to create a temporary sub-folder in S3 (`uploads/tmp/customer-videos/`). It must be validated as a simple alphanumeric string to prevent security issues.
-   **Service Logic (`file.service.js`):** The service generates a unique S3 key (using `uuid`) inside the `uploads/tmp/{fileCategory}/` path and uses `storage.generatePresignedUploadUrl()` to create the secure URL.
-   **Response:**
    ```json
    {
      "success": true,
      "status": 1,
      "uploadUrl": "https://your-bucket.s3.amazonaws.com/...",
      "key": "uploads/tmp/customer-videos/some-uuid.mp4"
    }
    ```

### 2. The Main POST Route (e.g., `/customer-leads`)

This is the endpoint that consumes the final form data *after* the file has been uploaded.

-   **Route (`customerLead.route.js`):**
    -   The route handler should be wrapped by the `transactional()` middleware.
    -   The handler should call the service directly, not a controller.
    -   Example: `router.post('/', transactional(createCustomerLeadService));`

-   **Request Body:** The request body is JSON. It contains the normal form data, plus one or more `key` fields referencing the files uploaded in Phase 1.
    ```json
    {
      "customerName": "John Doe",
      "mobileNumber": "555-1234",
      "videoUrlKey": "uploads/tmp/customer-videos/some-uuid.mp4"
    }
    ```
-   **Swagger Documentation:** The Swagger comments must clearly document these `key` fields instead of `type: string, format: binary`.

-   **Service Logic (`createCustomerLeadService.js`):** This is the most critical part. The service **must** follow this sequence to ensure atomicity and handle failures gracefully.

    1.  **Create DB Record:** Create the main database record (e.g., `CustomerLead`) first, inside the transaction. This reserves a unique `_id`.
    2.  **Process Files in a `try...catch` block:** This block is for handling external S3 API calls, which are not part of the DB transaction.
    3.  **Copy Files:** Loop through the provided `key`s. For each key, construct a permanent S3 key (e.g., `customer-leads/{lead._id}/video.mp4`) and use `storage.copyFile()` to move the file from its `tmp/` location.
    4.  **Track Success:** Keep an array of files that were successfully copied to the permanent location.
    5.  **Handle S3 Failure (The Compensating Action):** If any `copyFile` operation fails, the `catch` block is triggered.
        -   It **must** immediately loop through the array of successfully copied files and delete them from the permanent location.
        -   It then re-throws the error. The `transactional` middleware will catch this, abort the database transaction (deleting the `CustomerLead` record), and leave the system in a clean state.
    6.  **Update DB Record:** If all S3 copy operations succeed, update the original database record with the permanent file locations/keys.
    7.  **Delete Temporary Files:** Finally, delete the original files from the `uploads/tmp/` directory.

### 3. Handling Orphaned Temporary Files

-   **Problem:** A user might get a presigned URL, upload a file, but then close their browser without ever submitting the main form. This leaves an "orphaned" file in our `uploads/tmp/` directory.
-   **Solution:** An **S3 Lifecycle Policy**. A rule must be configured on the S3 bucket to automatically and permanently delete any object under the `uploads/tmp/` prefix that is more than 1 or 2 days old. This is a "set it and forget it" cleanup mechanism that requires no custom code.

By adhering to this guide, all file upload features will be consistent, secure, and robust. 