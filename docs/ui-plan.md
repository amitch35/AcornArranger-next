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

### **1. Dashboard (`/`)**
```
┌─────────────────────────────────────────────────────────┐
│ Overview & Quick Actions                                │
├─────────────────────────────────────────────────────────┤
│ 📊 Today's Stats                                        │
│ • Unscheduled: 12 appointments                          │
│ • Active Teams: 3                                       │
│ • Staff Available: 8                                    │
├─────────────────────────────────────────────────────────┤
│ 🚀 Quick Actions                                        │
│ [Build Today's Schedule] [View Unscheduled] [Properties]│
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
│ • Property | Time | Status | Staff | Actions           │
└─────────────────────────────────────────────────────────┘
```

**Enhanced Filters:**
- **Status**: Unconfirmed, Confirmed, Completed, Completed (Invoiced), Cancelled
- **Services**: All available services from ResortCleaning
- **Date Range**: From/To with validation
- **Show Unscheduled Only**: Quick filter toggle

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
│ [Clear Filters]                                         │
├─────────────────────────────────────────────────────────┤
│ 📋 Properties List                                      │
│ [Pagination] [Show: 25 ▼]                              │
│ • Name | Address | Cleaning Time | Double Units | Status│
└─────────────────────────────────────────────────────────┘
```

**Property Detail Modal:**
```
┌─────────────────────────────────────────────────────────┐
│ Edit Property: Yosemite Log Cabin                      │
├─────────────────────────────────────────────────────────┤
│ Cleaning Time: [2] hours [30] minutes                  │
│ Double Units: [Select Dependencies ▼]                  │
│ • Bear Suite (ID: 123) [🗑️]                           │
│ • Creature Suite (ID: 124) [🗑️]                       │
│ [+ Add Property Dependency]                            │
├─────────────────────────────────────────────────────────┤
│ [Save] [Cancel]                                        │
└─────────────────────────────────────────────────────────┘
```

**Enhanced Filters:**
- **Status**: Active, Inactive
- **Cleaning Time**: Range filter (e.g., 1-3 hours, 3-6 hours)

### **5. Staff (`/staff`)**
```
┌─────────────────────────────────────────────────────────┐
│ Staff                                                   │
├─────────────────────────────────────────────────────────┤
│ 🔍 Filters                                              │
│ Status: ☑️ Active ☑️ Unverified | Role: [All ▼]        │
│ Can Clean: ☑️ Yes ☑️ No | [Clear Filters]              │
├─────────────────────────────────────────────────────────┤
│ 📋 Staff List                                           │
│ [Pagination] [Show: 25 ▼]                              │
│ • Name | Role | Status | Can Clean | Shifts | Actions  │
└─────────────────────────────────────────────────────────┘
```

**Enhanced Filters:**
- **Status**: Active, Inactive, Unverified
- **Role**: Filter by role type (Housekeeper, Supervisor, etc.)
- **Can Clean**: Boolean filter for cleaning capability
- **Shift Availability**: Filter by current shift status

### **6. Role Settings (`/settings/roles`)**
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
- **Staff**: Synced from ResortCleaning/Homebase, no local editing
- **Properties**: Synced from ResortCleaning, limited editing for scheduling optimization
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
