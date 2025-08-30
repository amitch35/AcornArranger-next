# AcornArranger Next.js Rebuild - Page Structure & Routing

## 🎯 **Overview**
This document defines the complete page structure, routing, and navigation for the AcornArranger Next.js application. It complements the UI_PLAN.md and provides developers with a clear understanding of the application's routing architecture.

---

## 🏗️ **App Router Structure**

### **Root Layout (`app/layout.tsx`)**
- **Providers**: TanStack Query, Theme, Toasts
- **Global Styles**: Tailwind CSS, shadcn/ui components
- **Base HTML**: Meta tags, fonts, favicon

### **Authentication Layout (`app/auth/layout.tsx`)**
- **Public Routes**: Login, signup, password reset
- **No Authentication Required**: Accessible to all users

### **Protected Layout (`app/protected/layout.tsx`)**
- **Authentication Required**: All main application pages
- **Sidebar Navigation**: Collapsible navigation with active states
- **Header**: Logo, breadcrumbs, profile dropdown

---

## 📱 **Page Structure & Routes**

### **1. Landing Page (`/`)**
```
Route: app/page.tsx
Layout: app/protected/layout.tsx
Access: Authenticated users only
```

**Purpose**: Dashboard overview with quick actions and daily stats
**Content**:
- Today's unscheduled appointments count
- Active teams for the day
- Available staff count
- Quick action buttons (Build Schedule, View Unscheduled, Properties)

---

### **2. Appointments (`/appointments`)**
```
Route: app/appointments/page.tsx
Layout: app/protected/layout.tsx
Access: Authenticated users only
```

**Purpose**: View and filter all appointments with enhanced filtering
**Content**:
- **Filters Section**:
  - Date range (From/To)
  - Status checkboxes (Unconfirmed, Confirmed, Completed, etc.)
  - Service type checkboxes (Departure Clean, Deep Clean, etc.)
  - Show Unscheduled Only toggle
  - Clear Filters button
- **Appointments List**:
  - Sortable columns (Property, Time, Status, Staff, Actions)
  - Pagination controls
  - Page size selector (25, 50, 100)
  - Bulk actions (if applicable)

---

### **3. Schedule Builder (`/schedule`) - Core Feature**
```
Route: app/schedule/page.tsx
Layout: app/protected/layout.tsx
Access: Authenticated users only (Admin for editing)
```

**Purpose**: Daily team management and schedule building
**Content**:
- **Header Section**:
  - Date picker (single day selection)
  - Action buttons (Generate Plan, Save Draft, Confirm Day)
- **Staff Selection Panel**:
  - Available staff grid with multi-select
  - Search and filter capabilities
  - Availability indicators
- **Build Options Panel** (Collapsible):
  - Services selection
  - Routing type dropdown
  - Cleaning window input
  - Max hours input
  - Target staff count input
- **Status Indicators**:
  - Error count badges
  - Unscheduled appointments count
  - Shift conflict warnings
- **Daily Plans Board**:
  - Team columns with drag & drop
  - Staff assignments per team
  - Appointment assignments per team
  - Add/remove teams functionality

---

### **4. Properties (`/properties`)**
```
Route: app/properties/page.tsx
Layout: app/protected/layout.tsx
Access: Authenticated users only
```

**Purpose**: View properties (read-only) with limited editing for scheduling optimization
**Content**:
- **Filters Section**:
  - Status checkboxes (Active, Inactive)
  - City filter (combobox)
  - Cleaning time range filter (hour/minute pickers)
  - Search input
  - Clear Filters button
- **Properties List**:
  - Columns: Name, City, State, Estimated Cleaning Time, Double Units, Status
  - Pagination controls
  - Page size selector
  - Row actions (View Details, Edit Scheduling)

**Property Detail Modal/Page**:
```
Route: app/properties/[id]/page.tsx
Layout: app/protected/layout.tsx
Access: Authenticated users only
```

**Content**:
- Property information (read-only)
- Current scheduling overrides with badges
- Edit Scheduling button (admin only)

**Property Edit Page**:
```
Route: app/properties/[id]/edit/page.tsx
Layout: app/protected/layout.tsx
Access: Admin users only
```

**Content**:
- Estimated cleaning time (hour/minute picker)
- Double-unit dependencies (visual multi-select)
- Save/Cancel buttons

---

### **5. Staff (`/staff`)**
```
Route: app/staff/page.tsx
Layout: app/protected/layout.tsx
Access: Authenticated users only
```

**Purpose**: View staff information (read-only) with availability and role filtering
**Content**:
- **Filters Section**:
  - Status checkboxes (Active, Inactive, Unverified)
  - Role filter dropdown
  - Can Clean filter (Yes/No)
  - Search input
  - Clear Filters button
- **Staff List**:
  - Columns: Name, Role, Status, Can Clean, Shifts, Actions
  - Pagination controls
  - Page size selector
  - Row actions (View Details)

**Staff Detail Page**:
```
Route: app/staff/[id]/page.tsx
Layout: app/protected/layout.tsx
Access: Authenticated users only
```

**Content**:
- Staff information (read-only)
- Weekly availability blocks
- Shift information from Homebase
- No edit controls

---

### **6. Role Settings (`/settings/roles`)**
```
Route: app/settings/roles/page.tsx
Layout: app/protected/layout.tsx
Access: Admin users only
```

**Purpose**: Configure role settings that affect scheduling algorithm priority
**Content**:
- **Roles List**:
  - Columns: Title, Description, Priority, Can Lead, Can Clean
  - Inline editing for role properties
  - Priority sliders/inputs
  - Boolean toggles for capabilities

---

### **7. Authentication Pages**
```
Route: app/auth/login/page.tsx
Layout: app/auth/layout.tsx
Access: Public
```

**Content**: Login form with email/password

```
Route: app/auth/signup/page.tsx
Layout: app/auth/layout.tsx
Access: Public
```

**Content**: Signup form with validation

```
Route: app/auth/forgot-password/page.tsx
Layout: app/auth/layout.tsx
Access: Public
```

**Content**: Password reset form

```
Route: app/auth/confirm/page.tsx
Layout: app/auth/layout.tsx
Access: Public
```

**Content**: Email confirmation page

---

## 🧭 **Navigation Structure**

### **Sidebar Navigation (Collapsible)**
```
📋 View Appointments    → /appointments
📅 Schedule             → /schedule
🏠 Properties           → /properties
👥 Staff                → /staff
⚙️ Role Settings        → /settings/roles
```

**States**:
- **Collapsed**: Icons only with tooltips
- **Expanded**: Icons + labels
- **Active**: Highlighted current page

### **Breadcrumb Navigation**
```
Home > Appointments
Home > Schedule > 2025-01-15
Home > Properties > Yosemite Log Cabin
Home > Staff > Liz Becker
Home > Settings > Roles
```

---

## 🔐 **Access Control Matrix**

| Page | Staff Access | Admin Access | Public Access |
|------|-------------|--------------|---------------|
| `/` (Dashboard) | ✅ Read | ✅ Read | ❌ |
| `/appointments` | ✅ Read | ✅ Read | ❌ |
| `/schedule` | ✅ Read Only | ✅ Full Access | ❌ |
| `/properties` | ✅ Read | ✅ Read + Limited Edit | ❌ |
| `/staff` | ✅ Read | ✅ Read | ❌ |
| `/settings/roles` | ❌ | ✅ Full Access | ❌ |
| `/auth/*` | ❌ | ❌ | ✅ |

---

## 📁 **File Organization**

### **App Directory Structure**
```
app/
├── layout.tsx                    # Root layout with providers
├── page.tsx                      # Dashboard landing page
├── auth/
│   ├── layout.tsx               # Auth layout (no sidebar)
│   ├── login/page.tsx           # Login page
│   ├── signup/page.tsx          # Signup page
│   ├── forgot-password/page.tsx # Password reset
│   └── confirm/page.tsx         # Email confirmation
├── protected/
│   ├── layout.tsx               # Protected layout with sidebar
│   ├── appointments/
│   │   └── page.tsx            # Appointments list
│   ├── schedule/
│   │   └── page.tsx            # Schedule builder
│   ├── properties/
│   │   ├── page.tsx            # Properties list
│   │   └── [id]/
│   │       ├── page.tsx        # Property detail
│   │       └── edit/page.tsx   # Property edit (admin)
│   ├── staff/
│   │   ├── page.tsx            # Staff list
│   │   └── [id]/page.tsx       # Staff detail
│   └── settings/
│       └── roles/page.tsx      # Role settings (admin)
└── globals.css                  # Global styles
```

### **Component Organization**
```
components/
├── layout/
│   ├── header.tsx              # Header with logo, breadcrumbs, profile
│   ├── sidebar.tsx             # Collapsible navigation
│   └── breadcrumbs.tsx         # Breadcrumb navigation
├── ui/                         # shadcn/ui components
├── forms/                      # Form components
├── tables/                     # Table components
└── schedule/                   # Schedule-specific components
    ├── staff-selector.tsx      # Staff selection grid
    ├── build-options.tsx       # Collapsible build options
    ├── plan-board.tsx          # Drag & drop plan board
    └── team-column.tsx         # Individual team column
```

---

## 🚀 **Implementation Priority**

### **Phase 1: Foundation**
1. **Root Layout** - Providers and global styles
2. **Protected Layout** - Sidebar and header structure
3. **Dashboard** - Basic landing page

### **Phase 2: Core Navigation**
1. **Sidebar** - Collapsible navigation with routing
2. **Header** - Logo, breadcrumbs, profile dropdown
3. **Breadcrumbs** - Dynamic navigation breadcrumbs

### **Phase 3: Enhanced Filtering (Task 13)**
1. **Table Components** - Sortable, paginated tables
2. **Filter System** - Consistent filtering across all views
3. **Search Components** - Global and contextual search

### **Phase 4: Entity Views**
1. **Properties** - List, detail, and limited editing
2. **Staff** - List and detail views
3. **Appointments** - Enhanced list with filters

### **Phase 5: Schedule Builder (Core Feature)**
1. **Staff Selection** - Multi-select with availability
2. **Build Options** - Collapsible algorithm options
3. **Plan Board** - Drag & drop team management

---

## 📋 **Routing Considerations**

### **Dynamic Routes**
- **Properties**: `/properties/[id]` for individual property views
- **Staff**: `/staff/[id]` for individual staff views
- **Schedule**: `/schedule?date=YYYY-MM-DD` for date-specific views

### **Query Parameters**
- **Filtering**: `?status=active&city=Yosemite&page=2`
- **Date Selection**: `?date=2025-01-15`
- **Pagination**: `?page=1&size=25`

### **State Management**
- **URL State**: Filters and pagination reflected in URL
- **Local Storage**: User preferences (sidebar state, build options)
- **Server State**: Entity data via TanStack Query

---

*This document serves as the primary reference for page structure, routing, and navigation implementation. It should be updated as the application evolves.*
