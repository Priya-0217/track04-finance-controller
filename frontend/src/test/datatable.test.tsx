import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable, type Column } from '../components/DataTable';

interface TestRow {
  id: string;
  name: string;
  amount: number;
}

describe('DataTable Component (components/DataTable.tsx)', () => {
  const mockData: TestRow[] = [
    { id: 'txn-1', name: 'Order Beta', amount: 5000 },
    { id: 'txn-2', name: 'Order Alpha', amount: 15000 },
    { id: 'txn-3', name: 'Order Gamma', amount: 2500 },
  ];

  const columns: Column<TestRow>[] = [
    { key: 'id', header: 'ID', sortable: true },
    { key: 'name', header: 'Merchant Name', sortable: true },
    { key: 'amount', header: 'Amount', sortable: true, align: 'right' },
  ];

  it('renders table headers and rows accurately', () => {
    render(
      <DataTable
        columns={columns}
        data={mockData}
        keyExtractor={(row) => row.id}
      />
    );

    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Merchant Name')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Order Beta')).toBeInTheDocument();
    expect(screen.getByText('Order Alpha')).toBeInTheDocument();
    expect(screen.getByText('Order Gamma')).toBeInTheDocument();
  });

  it('sorts rows when column headers are clicked', () => {
    render(
      <DataTable
        columns={columns}
        data={mockData}
        keyExtractor={(row) => row.id}
        defaultSortKey="amount"
        defaultSortAsc={true}
      />
    );

    // Initial ascending sort by amount: 2500, 5000, 15000
    const rowsBefore = screen.getAllByRole('row');
    expect(rowsBefore[1]).toHaveTextContent('Order Gamma');

    // Click 'Amount' header to toggle to descending: 15000, 5000, 2500
    const amountHeader = screen.getByText('Amount');
    fireEvent.click(amountHeader);

    const rowsAfter = screen.getAllByRole('row');
    expect(rowsAfter[1]).toHaveTextContent('Order Alpha');
  });

  it('shows empty message when no records are supplied', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        keyExtractor={(row) => row.id}
        emptyMessage="No financial records found"
      />
    );

    expect(screen.getByText('No financial records found')).toBeInTheDocument();
  });
});
