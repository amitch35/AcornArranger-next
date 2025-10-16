import { http, HttpResponse } from "msw";

// Minimal in-memory data sets for demos/tests
const demoAppointments = Array.from({ length: 37 }, (_, i) => ({
  id: i + 1,
  date: new Date(Date.now() - i * 86400000).toISOString(),
  status: (i % 3 === 0 ? "Scheduled" : i % 3 === 1 ? "Completed" : "Cancelled"),
  staff_name: `Staff ${((i % 5) + 1)}`,
  property_name: `Property ${((i % 7) + 1)}`,
}));

const demoProperties = Array.from({ length: 52 }, (_, i) => ({
  properties_id: i + 1,
  property_name: `Property ${i + 1}`,
  estimated_cleaning_mins: 60 + (i % 4) * 15,
  double_unit: i % 5 === 0,
  address: {
    city: `City ${(i % 10) + 1}`,
    address: `${100 + i} Main St`,
    country: "USA",
    state_name: "CA",
    postal_code: `9${(1000 + i).toString().slice(-4)}`,
  },
  status: { status: i % 2 === 0 ? "Active" : "Inactive", status_id: i % 2 },
}));

const demoStaff = Array.from({ length: 28 }, (_, i) => ({
  id: i + 1,
  name: `Staff ${i + 1}`,
  role: ["Admin", "Manager", "Staff"][i % 3],
  status: i % 2 === 0 ? "Active" : "Inactive",
}));

function paginate<T>(data: T[], page: number, pageSize: number) {
  const start = Math.max(0, (page - 1) * Math.max(1, pageSize));
  const end = start + Math.max(1, pageSize);
  return { items: data.slice(start, end), total: data.length };
}

export const entityHandlers = [
  // Appointments
  http.get("/api/appointments", ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") || 1);
    const pageSize = Number(url.searchParams.get("pageSize") || 10);
    const { items, total } = paginate(demoAppointments, page, pageSize);
    return HttpResponse.json({ items, total }, { status: 200 });
  }),

  // Properties (aligns with real route expectations: pageSize)
  http.get("/api/properties", ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") || 1);
    const pageSize = Number(url.searchParams.get("pageSize") || 10);
    const { items, total } = paginate(demoProperties, page, pageSize);
    return HttpResponse.json({ items, total }, { status: 200 });
  }),

  // Staff
  http.get("/api/staff", ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") || 1);
    const pageSize = Number(url.searchParams.get("pageSize") || 10);
    const { items, total } = paginate(demoStaff, page, pageSize);
    return HttpResponse.json({ items, total }, { status: 200 });
  }),
];


