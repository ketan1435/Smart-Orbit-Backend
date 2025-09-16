# Project Logs API Guide

## Overview

The Project Logs API provides comprehensive activity logging retrieval for projects with **guaranteed completeness**. This API ensures that all activity logs related to a specific project are retrieved, including:

- Direct project logs
- Related entity logs (CustomerLead, ClientProposal, BOM, PO, Quote, Sitework, SiteVisit, File)
- Embedded document logs (architectProposal, architectDocument, proposal, siteworkDocument)

## API Endpoints

### 1. Get Comprehensive Project Logs

**Endpoint:** `GET /api/v1/activity-logs/project/{projectId}`

**Description:** Retrieves all activity logs related to a specific project with comprehensive categorization and statistics.

**Authentication:** Admin only

**Parameters:**
- `projectId` (path, required): Project ID
- `startDate` (query, optional): Filter by start date (ISO format)
- `endDate` (query, optional): Filter by end date (ISO format)
- `action` (query, optional): Filter by action type
- `actionType` (query, optional): Filter by action type category
- `user` (query, optional): Filter by user ID
- `includeEmbedded` (query, optional, default: true): Include embedded document logs
- `includeRelated` (query, optional, default: true): Include related entity logs
- `page` (query, optional, default: 1): Page number
- `limit` (query, optional, default: 100, max: 500): Items per page

**Response Structure:**
```json
{
  "status": 1,
  "message": "Project logs fetched successfully",
  "data": {
    "logs": [...], // All logs in chronological order
    "categorizedLogs": {
      "project": [...], // Direct project logs
      "customerLead": [...], // Customer lead logs
      "clientProposal": [...], // Client proposal logs
      "bom": [...], // BOM logs
      "po": [...], // Purchase order logs
      "quote": [...], // Quote logs
      "sitework": [...], // Sitework logs
      "siteVisit": [...], // Site visit logs
      "file": [...], // File logs
      "embedded": {
        "architectProposal": [...], // Architect proposal logs
        "architectDocument": [...], // Architect document logs
        "proposal": [...], // Proposal logs
        "siteworkDocument": [...] // Sitework document logs
      },
      "workflow": [...], // Workflow action logs
      "communication": [...], // Communication logs
      "crud": [...], // CRUD operation logs
      "statusChange": [...] // Status change logs
    },
    "stats": {
      "totalLogs": 150,
      "actionStats": [...], // Actions breakdown
      "userStats": [...], // Users breakdown
      "targetStats": [...], // Target models breakdown
      "timelineStats": [...], // Timeline breakdown
      "embeddedStats": [...] // Embedded documents breakdown
    },
    "pagination": {
      "page": 1,
      "limit": 100,
      "total": 150,
      "totalPages": 2
    },
    "projectId": "project_id_here",
    "queryOptions": {
      "startDate": "2024-01-01",
      "endDate": "2024-12-31",
      "action": "create",
      "actionType": "CRUD",
      "user": "user_id_here",
      "includeEmbedded": true,
      "includeRelated": true
    }
  }
}
```

### 2. Get Project Log Statistics

**Endpoint:** `GET /api/v1/activity-logs/project/{projectId}/stats`

**Description:** Retrieves comprehensive statistics for all activity logs related to a specific project.

**Authentication:** Admin only

**Parameters:**
- `projectId` (path, required): Project ID
- `startDate` (query, optional): Filter by start date (ISO format)
- `endDate` (query, optional): Filter by end date (ISO format)

**Response Structure:**
```json
{
  "status": 1,
  "message": "Project log statistics fetched successfully",
  "data": {
    "totalLogs": 150,
    "actionStats": [
      { "_id": "create", "count": 45 },
      { "_id": "update", "count": 30 },
      { "_id": "approve", "count": 15 }
    ],
    "userStats": [
      {
        "_id": { "user": "user_id", "userModel": "User" },
        "count": 25
      }
    ],
    "targetStats": [
      { "_id": "Project", "count": 20 },
      { "_id": "BOM", "count": 15 }
    ],
    "timelineStats": [
      {
        "_id": { "year": 2024, "month": 1, "day": 15 },
        "count": 5
      }
    ],
    "embeddedStats": [
      { "_id": "architectProposal", "count": 10 },
      { "_id": "architectDocument", "count": 8 }
    ],
    "projectId": "project_id_here"
  }
}
```

## Key Features

### 1. Guaranteed Completeness
The API uses multiple query strategies to ensure no logs are missed:
- Direct project logs: `{ targetModel: 'Project', targetId: projectId }`
- Related entity logs: `{ 'metadata.projectId': projectId }`
- Embedded document logs: `{ 'metadata.embeddedDocument': '...', 'metadata.projectId': projectId }`

### 2. Comprehensive Categorization
Logs are automatically categorized by:
- **Target Model**: Project, CustomerLead, ClientProposal, BOM, PO, Quote, Sitework, SiteVisit, File
- **Embedded Documents**: architectProposal, architectDocument, proposal, siteworkDocument
- **Action Type**: Workflow, Communication, CRUD, Status Change

### 3. Rich Statistics
Provides detailed analytics including:
- Total log count
- Action breakdown
- User activity breakdown
- Target model breakdown
- Timeline analysis
- Embedded document analysis

### 4. Flexible Filtering
Supports filtering by:
- Date range
- Action type
- Action category
- User
- Include/exclude embedded documents
- Include/exclude related entities

### 5. Pagination Support
- Configurable page size (max 500)
- Total count and page information
- Efficient querying with skip/limit

## Usage Examples

### Get All Project Logs
```bash
GET /api/v1/activity-logs/project/64f1a2b3c4d5e6f7g8h9i0j1
```

### Get Project Logs with Date Filter
```bash
GET /api/v1/activity-logs/project/64f1a2b3c4d5e6f7g8h9i0j1?startDate=2024-01-01&endDate=2024-12-31
```

### Get Project Logs for Specific User
```bash
GET /api/v1/activity-logs/project/64f1a2b3c4d5e6f7g8h9i0j1?user=64f1a2b3c4d5e6f7g8h9i0j2
```

### Get Only Workflow Actions
```bash
GET /api/v1/activity-logs/project/64f1a2b3c4d5e6f7g8h9i0j1?actionType=Workflow
```

### Get Project Logs Without Embedded Documents
```bash
GET /api/v1/activity-logs/project/64f1a2b3c4d5e6f7g8h9i0j1?includeEmbedded=false
```

### Get Project Statistics
```bash
GET /api/v1/activity-logs/project/64f1a2b3c4d5e6f7g8h9i0j1/stats
```

## Database Optimization

The API is optimized with specific indexes for efficient querying:

```javascript
// Base indexes
{ user: 1, timestamp: -1 }
{ targetModel: 1, targetId: 1, timestamp: -1 }
{ action: 1, timestamp: -1 }
{ userModel: 1, timestamp: -1 }
{ timestamp: -1 }

// Embedded document indexes
{ 'metadata.embeddedDocument': 1, targetModel: 1, targetId: 1 }
{ 'metadata.embeddedField': 1, targetModel: 1, targetId: 1 }
{ 'metadata.embeddedDocument': 1, 'metadata.embeddedField': 1, action: 1 }
{ 'metadata.embeddedDocId': 1, targetModel: 1, targetId: 1 }
```

## Error Handling

The API includes comprehensive error handling:
- Invalid project ID validation
- Date format validation
- Pagination parameter validation
- Database query error handling
- Graceful degradation for missing data

## Performance Considerations

- Uses MongoDB aggregation pipelines for efficient statistics
- Implements proper indexing for fast queries
- Supports pagination to handle large datasets
- Caches frequently accessed data
- Optimized queries with proper field selection

## Security

- Admin-only access for sensitive log data
- Input validation and sanitization
- SQL injection prevention
- Rate limiting support
- Audit trail for API access

## Monitoring and Logging

The API includes built-in monitoring:
- Query performance tracking
- Error rate monitoring
- Usage analytics
- Database query optimization
- Response time tracking

This comprehensive Project Logs API ensures that you can retrieve all activity logs related to a project with complete confidence and detailed categorization for better analysis and audit trails.
