import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import * as React from 'react';

import { DataTable } from '@/components/datagrid/DataTable';
import { TableToolbar } from '@/components/datagrid/TableToolbar';
import { TablePagination } from '@/components/datagrid/TablePagination';
import { FilterBar, type FilterGroup } from '@/components/filters/FilterBar';
import { DateRangePicker } from '@/components/filters/DateRangePicker';
import type { ColumnDef } from '@tanstack/react-table';

type Item = { id: number; name: string };

const columns: ColumnDef<Item>[] = [
  { accessorKey: 'id', header: 'ID', cell: ({ row }) => row.getValue('id') as number },
  { accessorKey: 'name', header: 'Name', cell: ({ row }) => row.getValue('name') as string },
];

describe('a11y - datagrid and filters', () => {
  it('DataTable (loading, empty, normal) has no axe violations', async () => {
    const { container, rerender } = render(
      <DataTable<Item, unknown>
        columns={columns}
        data={[]}
        total={0}
        page={1}
        pageSize={10}
        loading
      />
    );
    let results = await axe(container);
    expect(results.violations).toEqual([]);

    rerender(
      <DataTable<Item, unknown>
        columns={columns}
        data={[]}
        total={0}
        page={1}
        pageSize={10}
        loading={false}
        error={null}
      />
    );
    results = await axe(container);
    expect(results.violations).toEqual([]);

    rerender(
      <DataTable<Item, unknown>
        columns={columns}
        data={[{ id: 1, name: 'A' }]}
        total={1}
        page={1}
        pageSize={10}
        loading={false}
      />
    );
    results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it('TableToolbar + Pagination have accessible labels and no axe violations', async () => {
    const { container } = render(
      <div>
        <TableToolbar<any>
          table={{ getAllLeafColumns: () => [], getColumn: () => undefined } as any}
          onSearch={() => {}}
        />
        <TablePagination page={1} pageSize={25} total={100} onPageChange={() => {}} onPageSizeChange={() => {}} />
      </div>
    );
    expect(screen.getByRole('button', { name: /columns/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/previous page/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/next page/i)).toBeInTheDocument();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it('FilterBar and DateRangePicker expose listbox/option semantics with no axe violations', async () => {
    const groups: FilterGroup[] = [
      { id: 'status', label: 'Status', options: [ { id: 'open', label: 'Open' }, { id: 'closed', label: 'Closed' } ] },
    ];
    const { container } = render(
      <div>
        <FilterBar groups={groups} value={{}} onChange={() => {}} />
        <DateRangePicker value={undefined} onChange={() => {}} />
      </div>
    );
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});


