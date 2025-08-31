# AcornArranger Next.js Rebuild - Page Structure & Routing

## 🎯 **Overview**
This document defines the complete page structure, routing, and navigation for the AcornArranger Next.js application. It complements the ui-plan.md and provides developers with a clear understanding of the application's routing architecture.

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
Access: Authenticated users only (different content based on role)
```

**Purpose**: Role-based landing page - Dashboard for authorized users, activation info for new users
**Content for Authorized Users**:
- Today's unscheduled appointments count
- Active teams for the day
- Available staff count
- Quick action buttons (Build Schedule, View Unscheduled, Properties)

**Content for Non-Authorized Users**:
- Welcome message and AcornArranger logo
- Information about account activation process
- Contact administrator instructions
- Access to profile settings only

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
  - Date range (From/To service dates)
  - Status checkboxes (Unconfirmed, Confirmed, Completed, Completed (Invoiced), Cancelled)
  - Service type checkboxes (Departure Clean, Deep Clean, etc.)
  - Show Unscheduled Only toggle
  - Clear Filters button
- **Appointments List**:
  - Sortable columns (Appointment ID, Service Time, Property, Staff, T/A, Next Arrival Time, Service, Status)
  - Pagination controls
  - Page size selector (20, 50, 100, 200)

---

### **3. Schedule Builder (`/schedule`) - Core Feature**
```
Route: app/schedule/page.tsx
Layout: app/protected/layout.tsx
Access: Authenticated users only
```

**Purpose**: Daily team management and schedule building
**Content**:
- **Header Section**:
  - Date picker (single day selection)
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
- **Status Indicators and Actions**:
  - Error count badges
  - Unscheduled appointments count
  - Shift conflict warnings
  - Action buttons (Generate Plan, Duplicate(to new mutable plans), Send)
- **Daily Plans Board**:
  - Team columns/cards with drag & drop
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
  - Cleaning time range filter
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
- Edit Scheduling parameters button

**Property Edit Page**:
```
Route: app/properties/[id]/edit/page.tsx
Layout: app/protected/layout.tsx
Access: Authorized users only
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
  - Can Lead filter (Yes/No)
  - Search input
  - Clear Filters button
- **Staff List**:
  - Columns: Name, Role, Status, Can Clean, Can Lead, Shifts, Actions
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
Access: Authorized users only
```

**Purpose**: Configure role settings that affect scheduling algorithm priority
**Content**:
- **Roles List**:
  - Columns: Title, Description, Priority, Can Lead, Can Clean
  - Inline editing for role properties
  - Priority sliders/inputs
  - Boolean toggles for capabilities

---

### **7. Profile Settings (`/profile`)**
```
Route: app/profile/page.tsx
Layout: app/protected/layout.tsx
Access: All authenticated users (both authorized and non-authorized)
```

**Purpose**: User profile management accessible to all authenticated users
**Content**:
- Profile information display and editing
- Password change functionality
- Account preferences
- Theme settings

### **8. Authentication Pages**
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
📋 View Appointments    → /appointments (authorized users only)
📅 Schedule             → /schedule (authorized users only)
🏠 Properties           → /properties (authorized users only)
👥 Staff                → /staff (authorized users only)
⚙️ Role Settings        → /settings/roles (authorized users only)
👤 Profile              → /profile (all authenticated users)
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

| Page | Non-Authorized Users | Authorized Users | Public Access |
|------|---------------------|------------------|---------------|
| `/` (Landing) | ✅ Info Only | ✅ Dashboard | ❌ |
| `/profile` | ✅ Full Access | ✅ Full Access | ❌ |
| `/appointments` | ❌ | ✅ Read | ❌ |
| `/schedule` | ❌ | ✅ Full Access | ❌ |
| `/properties` | ❌ | ✅ Read + Limited Edit | ❌ |
| `/staff` | ❌ | ✅ Read | ❌ |
| `/settings/roles` | ❌ | ✅ Full Access | ❌ |
| `/auth/*` | ❌ | ❌ | ✅ |

**Role Definitions:**
- **Non-Authorized Users**: Users with `authenticated` role (new accounts awaiting admin activation)
- **Authorized Users**: Users with `authorized_user` role (activated accounts with full access)
---

## 📁 **File Organization**

### **App Directory Structure**
```
app/
├── layout.tsx                    # Root layout with providers
├── page.tsx                      # Role-based landing page
├── auth/
│   ├── layout.tsx               # Auth layout (no sidebar)
│   ├── login/page.tsx           # Login page
│   ├── signup/page.tsx          # Signup page
│   ├── forgot-password/page.tsx # Password reset
│   └── confirm/page.tsx         # Email confirmation
├── protected/
│   ├── layout.tsx               # Protected layout with sidebar
│   ├── profile/
│   │   └── page.tsx            # Profile settings (all authenticated users)
│   ├── appointments/
│   │   └── page.tsx            # Appointments list (authorized users only)
│   ├── schedule/
│   │   └── page.tsx            # Schedule builder (authorized users only)
│   ├── properties/
│   │   ├── page.tsx            # Properties list (authorized users only)
│   │   └── [id]/
│   │       ├── page.tsx        # Property detail (authorized users only)
│   │       └── edit/page.tsx   # Property edit (authorized users only)
│   ├── staff/
│   │   ├── page.tsx            # Staff list (authorized users only)
│   │   └── [id]/page.tsx       # Staff detail (authorized users only)
│   └── settings/
│       └── roles/page.tsx      # Role settings (authorized users only)
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
    └── team-column.tsx         # Individual team column/card
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
