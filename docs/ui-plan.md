# AcornArranger Next.js Rebuild - Refined UI Plan

## 🎯 **Project Overview**
AcornArranger is being rebuilt as a modern Next.js application with a focus on daily scheduling management. The system is **read-only for core entities** (staff, properties) with limited editing capabilities for scheduling optimization.

## 🏗️ **Layout Architecture**

### **Header (Top Bar)**
```
[☰] [Logo + "AcornArranger"] [Breadcrumbs] [Profile Bubble ▼]
```
- **Sidebar Toggle**: Three-bar icon to expand/collapse sidebar
- **Logo & Brand**: Centered, prominent display
- **Breadcrumbs**: Current page navigation
- **Profile Section**: User avatar with dropdown for theme switch, settings, logout

### **Sidebar (Collapsible)**
```
📋 View Appointments
📅 Schedule  
🏠 Properties
👥 Staff
⚙️ Role Settings
```
- **Collapsed**: Icons only with tooltips
- **Expanded**: Icons + labels
- **Active State**: Highlighted current page

---

## 📱 **Page-by-Page UI Design**

### **1. Landing Page (`/`) - Role-Based Content**
```
┌─────────────────────────────────────────────────────────┐
│ Role-Based Landing Page                                 │
├─────────────────────────────────────────────────────────┤
│ 👥 Authorized Users: Dashboard                          │
│ 📊 Today's Stats                                        │
│ • Unscheduled: 12 appointments                          │
│ • Active Teams: 3                                       │
│ • Staff Available: 8                                    │
├─────────────────────────────────────────────────────────┤
│ 🚀 Quick Actions                                        │
│ [Build Today's Schedule] [View Unscheduled] [Properties]│
└─────────────────────────────────────────────────────────┘
```

**Non-Authorized Users Landing Page:**
```
┌─────────────────────────────────────────────────────────┐
│ Welcome to AcornArranger                                │
├─────────────────────────────────────────────────────────┤
│ 🏠 Logo & Branding                                      │
│ 📧 Account Status: Awaiting Activation                  │
├─────────────────────────────────────────────────────────┤
│ ℹ️ Information                                           │
│ • Your account has been created successfully            │
│ • Contact your administrator to activate your account  │
│ • You can access profile settings while waiting         │
├─────────────────────────────────────────────────────────┤
│ 🔗 Available Actions                                    │
│ [Profile Settings] [Contact Admin]                      │
└─────────────────────────────────────────────────────────┘
```

### **2. Appointments (`/appointments`)**
```
┌─────────────────────────────────────────────────────────┐
│ Appointments                                            │
├─────────────────────────────────────────────────────────┤
│ 🔍 Filters                                              │
│ Date: [From] [To] | Status: ☑️ Active ☑️ Confirmed     │
│ Services: ☑️ Departure ☑️ Deep Clean                   │
│ [Show Unscheduled Only] [Clear Filters]                │
├─────────────────────────────────────────────────────────┤
│ 📋 Appointments List                                    │
│ [Pagination: < 1 2 3 >] [Show: 50 ▼]                  │
│ • Appointment ID | Service Time | Property | Staff | T/A | Next Arrival Time | Service | Status │
└─────────────────────────────────────────────────────────┘
```

**Enhanced Filters:**
- **Status**: Unconfirmed, Confirmed, Completed, Completed (Invoiced), Cancelled
- **Services**: All available services from ResortCleaning
- **Date Range**: From/To service dates with validation
- **Show Unscheduled Only**: Quick filter toggle

**Appointment Table Columns:**
- **Appointment ID**: Unique identifier for tracking
- **Service Time**: When the cleaning service is performed (primary time reference)
- **Property**: Property name and location
- **Staff**: Assigned staff members (shows error icon if none assigned)
- **T/A**: Turn-around indicator (shows revision icon for turn-around appointments)
- **Next Arrival Time**: When the next guests are checking in (appointment must be completed by this time)
- **Service**: Type of cleaning service (Departure Clean, Deep Clean, etc.)
- **Status**: Current appointment status with color coding

### **3. Schedule (`/schedule`) - The Core Feature**
```
┌─────────────────────────────────────────────────────────┐
│ Schedule Builder - [Date Picker]                       │
├─────────────────────────────────────────────────────────┤
│ 👥 Available Staff                                      │
│ [Staff Selection Grid - Multi-select with search]      │
├─────────────────────────────────────────────────────────┤
│ ⚙️ Build Options [▶️ Collapsible]                      │
│ Services: ☑️ Departure ☑️ Deep Clean                   │
│ Routing: [Farthest to Office ▼]                        │
│ Cleaning Window: [6.0] hours                           │
│ Max Hours: [6.5] hours                                 │
│ Target Staff: [__] (optional)                          │
├─────────────────────────────────────────────────────────┤
│ 🎯 Actions & Indicators                                 │
│ ⚠️ Errors: 1 | 📅 Unscheduled: 12 | ⏰ Shift Issues: 2 │
│ [Build] [Copy] [Send]                                  │
├─────────────────────────────────────────────────────────┤
│ 📋 Daily Plans                                          │
│ [Filters] [Show: 10 ▼] [Page: < 1 >] [+ New Plan]     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Team 1 (ID: 5699)                                  │ │
│ │ Staff: Liz Becker [🗑️] [+ Add Staff]               │ │
│ │ Appointments: Yosemite Log Cabin [🗑️] [+ Add Appt] │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Collapsible Options**: Build algorithm options hidden by default
- **Staff Selection**: Grid layout with search/filter capabilities
- **Plan Management**: Drag & drop for staff/appointment assignment
- **Real-time Validation**: Show errors, unscheduled count, shift conflicts

### **4. Properties (`/properties`)**
```
┌─────────────────────────────────────────────────────────┐
│ Properties                                              │
├─────────────────────────────────────────────────────────┤
│ 🔍 Filters                                              │
│ Status: ☑️ Active ☑️ Inactive                           │
│ City: [Combobox with city options]                     │
│ Cleaning Time: [Range filter: 1-3h, 3-6h, 6h+]        │
│ [Search input] [Clear Filters]                         │
├─────────────────────────────────────────────────────────┤
│ 📋 Properties List                                      │
│ [Pagination] [Show: 25 ▼]                              │
│ • Property ID | Name | Estimated Cleaning Time | Double Unit References | Status | Actions │
└─────────────────────────────────────────────────────────┘
```

**Property Detail Modal:**
```
┌─────────────────────────────────────────────────────────┐
│ Property Details: Yosemite Log Cabin                   │
├─────────────────────────────────────────────────────────┤
│ 📍 Property Information                                 │
│ Property ID: 123                                        │
│ Property Name: Yosemite Log Cabin                       │
│ Status: Active                                          │
├─────────────────────────────────────────────────────────┤
│ 🏠 Address Information                                  │
│ Address: 123 Main Street                                │
│ City: Yosemite                                          │
│ State: CA                                               │
│ Postal Code: 95389                                      │
│ Country: USA                                            │
├─────────────────────────────────────────────────────────┤
│ ⚙️ Scheduling Options                                   │
│ Estimated Cleaning Time: [2] hours [30] minutes        │
│ Double Unit References: [Select Dependencies ▼]        │
│ • Bear Suite (ID: 124) [🗑️]                           │
│ • Creature Suite (ID: 125) [🗑️]                       │
│ [+ Add Property Dependency]                            │
├─────────────────────────────────────────────────────────┤
│ [Edit Property] [Close]                                │
└─────────────────────────────────────────────────────────┘
```

**Property Edit Modal:**
```
┌─────────────────────────────────────────────────────────┐
│ Edit Property: Yosemite Log Cabin                      │
├─────────────────────────────────────────────────────────┤
│ ⚙️ Scheduling Options                                   │
│ Estimated Cleaning Time: [2] hours [30] minutes        │
│ Double Units: [Select Dependencies ▼]                  │
│ • Bear Suite (ID: 124) [🗑️]                           │
│ • Creature Suite (ID: 125) [🗑️]                       │
│ [+ Add Property Dependency]                            │
├─────────────────────────────────────────────────────────┤
│ [Save] [Cancel]                                        │
└─────────────────────────────────────────────────────────┘
```

**Enhanced Filters:**
- **Status**: Active, Inactive
- **City**: Combobox with available city options for location-based filtering
- **Cleaning Time**: Range filter (e.g., 1-3 hours, 3-6 hours, 6+ hours)
- **Search**: Text input for property name or address search

**Property Table Columns:**
- **Property ID**: Unique property ID
- **Name**: Property name (e.g., "Yosemite Log Cabin")
- **Estimated Cleaning Time**: Formatted time display (e.g., "2 Hours 30 Minutes")
- **Double Unit References**: List of linked properties for scheduling dependencies
- **Status**: Active/Inactive status with color coding
- **Actions**: Edit button linking to property edit page

### **5. Staff (`/staff`)**
```
┌─────────────────────────────────────────────────────────┐
│ Staff                                                   │
├─────────────────────────────────────────────────────────┤
│ 🔍 Filters                                              │
│ Status: ☑️ Active ☑️ Inactive ☑️ Unverified            │
│ Role: [All ▼]                                           │
│ Can Clean: ☑️ Yes ☑️ No                                 │
│ Can Lead: ☑️ Yes ☑️ No                                 │
│ [Search input] [Clear Filters]                          │
├─────────────────────────────────────────────────────────┤
│ 📋 Staff List                                           │
│ [Pagination] [Show: 25 ▼]                              │
│ • Staff ID | Name | Role | Status | Can Clean | Can Lead | Actions │
└─────────────────────────────────────────────────────────┘
```

**Enhanced Filters:**
- **Status**: Active, Inactive, Unverified (three distinct statuses)
- **Role**: Filter by role type (Housekeeper, Supervisor, etc.)
- **Can Clean**: Boolean filter for cleaning capability
- **Search**: Text input for staff name search

**Staff Table Columns:**
- **Staff ID**: Unique user identifier
- **Name**: Staff member's full name
- **Role**: Role title (e.g., "Housekeeper", "Supervisor")
- **Status**: Current status with color coding (Active/Inactive/Unverified)
- **Actions**: View details button linking to staff detail page

**Staff Detail Modal:**
```
┌─────────────────────────────────────────────────────────┐
│ Staff Details: Liz Becker                               │
├─────────────────────────────────────────────────────────┤
│ 👤 Basic Information                                    │
│ Staff ID: 123                                           │
│ Name: Liz Becker                                        │
│ Role: Housekeeper                                       │
│ Status: Active                                          │
├─────────────────────────────────────────────────────────┤
│ 🎯 Role Capabilities                                    │
│ Can Lead Team: ☑️ Yes                                   │
│ Can Clean: ☑️ Yes                                       │
│ Priority: 3                                             │
├─────────────────────────────────────────────────────────┤
│ 📅 Current Shift Status                                 │
│ Shift: Available                                        │
│ Department: Housekeeping                                │
│ Location: Main Office                                   │
│ [View Full Shift Details]                               │
├─────────────────────────────────────────────────────────┤
│ [Close]                                                 │
└─────────────────────────────────────────────────────────┘
```

### **6. Profile Settings (`/profile`)**
```
┌─────────────────────────────────────────────────────────┐
│ Profile Settings                                        │
├─────────────────────────────────────────────────────────┤
│ 👤 User Information                                     │
│ Email: user@example.com [Edit]                          │
│ Name: John Doe [Edit]                                   │
│ Role: authenticated [Awaiting Activation]               │
├─────────────────────────────────────────────────────────┤
│ 🔐 Security                                             │
│ [Change Password] [Update Email]                        │
├─────────────────────────────────────────────────────────┤
│ 🎨 Preferences                                          │
│ Theme: [Dark (default)] [Light] [System]               │
│ Language: [English ▼]                                   │
├─────────────────────────────────────────────────────────┤
│ ℹ️ Account Status                                        │
│ Status: Awaiting Administrator Activation               │
│ Contact: admin@acornarranger.com                        │
└─────────────────────────────────────────────────────────┘
```

### **7. Role Settings (`/settings/roles`)**
```
┌─────────────────────────────────────────────────────────┐
│ Role Settings                                           │
├─────────────────────────────────────────────────────────┤
│ 📋 Roles List                                           │
│ [Pagination] [Show: 25 ▼]                              │
│ • Title | Description | Priority | Can Lead | Can Clean│
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Housekeeper                                         │
│ │ Priority: [3] [Can Lead: ☑️] [Can Clean: ☑️]       │
│ │ Description: [Edit inline...]                       │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 🎨 **UI Component Library**

### **Enhanced Form Controls:**
- **Time Picker**: Hour/minute selector for cleaning times
- **Multi-Select**: Property dependency selector with search
- **Collapsible Sections**: Build options, advanced filters
- **Status Indicators**: Real-time error/warning displays

### **Data Display:**
- **Responsive Tables**: Sortable columns, row actions
- **Card Layouts**: Plan/team cards with inline editing
- **Pagination**: Smart pagination with page size options
- **Search & Filter**: Global search + contextual filters

### **Interactive Elements:**
- **Drag & Drop**: Staff/appointment assignment in plans
- **Inline Editing**: Quick property edits without modals
- **Real-time Updates**: Live status changes and counts
- **Bulk Actions**: Multi-select operations where applicable

---

## 🔧 **Technical Implementation Notes**

### **State Management:**
- **TanStack Query**: For server state (appointments, properties, staff)
- **Zustand**: For UI state (filters, pagination, form data)
- **React Hook Form**: For all form handling with Zod validation

### **Performance Optimizations:**
- **Virtual Scrolling**: For large lists (1000+ appointments)
- **Debounced Search**: Filter inputs with proper debouncing
- **Optimistic Updates**: Immediate UI feedback for actions
- **Background Sync**: Real-time updates without blocking UI

### **Accessibility:**
- **Keyboard Navigation**: Full keyboard support for all interactions
- **Screen Reader**: Proper ARIA labels and descriptions
- **Focus Management**: Logical tab order and focus indicators
- **High Contrast**: Theme support for accessibility

---

## 📋 **Key Architectural Decisions**

### **Read-Only Entities:**
- **Staff**: Synced to database from ResortCleaning/Homebase, no local editing
- **Properties**: Synced from to database from ResortCleaning, limited editing for scheduling optimization
- **Services**: Read-only, used as filters only

### **Core Functionality:**
- **Schedule Builder**: Main interface for daily team management
- **Enhanced Filtering**: Consistent filtering across all list views
- **Modern Layout**: Header with collapsible sidebar instead of legacy design

### **User Experience Improvements:**
- **Collapsible Sections**: Build options hidden by default
- **Time Picker**: Hour/minute selector instead of raw minutes
- **Visual Selectors**: Property dependencies instead of ID typing
- **Drag & Drop**: Intuitive plan editing interface

---

## 🚀 **Next Steps for Implementation**

1. **Start with Layout Components**: Header, sidebar, and base layout
2. **Build Enhanced Filtering System**: Foundation for all list views (Task 13)
3. **Implement Schedule Builder**: Core functionality with collapsible options
4. **Create Property Editor**: Time picker and dependency selector
5. **Add Drag & Drop**: Staff/appointment assignment in plans
6. **Polish & Optimize**: Performance, accessibility, and UX refinements

---

*This document reflects the refined UI architecture based on user feedback and legacy system analysis. It serves as the primary reference for UI implementation decisions.*
