<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>ITFleet ITAM - Software Licenses &amp; SaaS Entitlements Audit</title>
    <style>
        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 10px;
            color: #1e293b;
            margin: 0;
            padding: 10px 15px;
        }
        .header {
            margin-bottom: 15px;
            border-bottom: 2px solid #026eff;
            padding-bottom: 8px;
        }
        .title {
            font-size: 18px;
            font-weight: bold;
            color: #0f172a;
        }
        .subtitle {
            font-size: 10px;
            color: #64748b;
            margin-top: 2px;
        }
        .stat-box {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 8px 12px;
            margin-bottom: 12px;
        }
        table.data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
        }
        table.data-table th {
            background-color: #f1f5f9;
            color: #334155;
            font-size: 9px;
            font-weight: bold;
            text-align: left;
            padding: 6px 8px;
            border-bottom: 1px solid #cbd5e1;
            text-transform: uppercase;
        }
        table.data-table td {
            padding: 6px 8px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 9px;
            color: #334155;
        }
        table.data-table tr:nth-child(even) td {
            background-color: #f8fafc;
        }
        .badge {
            display: inline-block;
            padding: 2px 5px;
            font-size: 8px;
            font-weight: bold;
            border-radius: 3px;
            text-transform: uppercase;
        }
        .badge-active { background-color: #ecfdf5; color: #047857; }
        .badge-expiring_soon { background-color: #fffbeb; color: #b45309; }
        .badge-expired { background-color: #fef2f2; color: #b91c1c; }
        .badge-perpetual { background-color: #f1f5f9; color: #475569; }
        .badge-cancelled { background-color: #f1f5f9; color: #64748b; }
        .footer {
            margin-top: 20px;
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
            font-size: 8px;
            color: #94a3b8;
            text-align: right;
        }
    </style>
</head>
<body>
    <div class="header">
        <table style="width: 100%;">
            <tr>
                <td>
                    <div class="title">ITFleet ITAM — Software Licenses &amp; SaaS Entitlements Audit</div>
                    <div class="subtitle">Enterprise Seat Utilization, Contract Renewals &amp; Annualized Software Spend</div>
                </td>
                <td style="text-align: right; vertical-align: top;">
                    <span style="font-weight: bold; color: #026eff; font-size: 12px;">ITFleet ITAM</span><br>
                    <span style="font-size: 9px; color: #64748b;">ISO 19770-1 SAM Compliance</span>
                </td>
            </tr>
        </table>
    </div>

    <div class="stat-box">
        <table style="width: 100%;">
            <tr>
                <td style="width: 24%;">
                    <strong>Tracked Contracts:</strong> {{ $total_licenses }} ({{ $active_licenses }} active)
                </td>
                <td style="width: 24%;">
                    <strong>Seat Utilization:</strong> {{ $assigned_seats }} / {{ $total_seats }} seats
                </td>
                <td style="width: 26%;">
                    <strong>Annualized Spend:</strong> PHP {{ number_format($annual_spend, 2) }}
                </td>
                <td style="width: 26%; text-align: right;">
                    <strong>Report Generated:</strong> {{ $generated_at }}
                </td>
            </tr>
        </table>
    </div>

    <table class="data-table">
        <thead>
            <tr>
                <th style="width: 22%;">Software Title &amp; Key</th>
                <th style="width: 16%;">Vendor</th>
                <th style="width: 11%;">Category</th>
                <th style="width: 12%;">Type &amp; Billing</th>
                <th style="width: 12%;">Seats (Used / Total)</th>
                <th style="width: 15%;">Renewal Status</th>
                <th style="width: 12%; text-align: right;">Annualized Cost</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($licenses as $license)
                @php
                    $assigned = (int) ($license->active_assignments_count ?? 0);
                    $utilization = $license->total_seats > 0 ? round(($assigned / $license->total_seats) * 100) : 0;
                @endphp
                <tr>
                    <td>
                        <strong>{{ $license->name }}</strong>
                        @if ($license->license_key)
                            <br><span style="color: #64748b; font-size: 8px;">{{ $license->license_key }}</span>
                        @endif
                    </td>
                    <td>{{ $license->vendor }}</td>
                    <td style="text-transform: capitalize;">{{ $license->category }}</td>
                    <td style="text-transform: uppercase;">
                        {{ $license->license_type }} &bull; {{ str_replace('_', '-', $license->billing_cycle) }}
                    </td>
                    <td>
                        <strong>{{ $assigned }} / {{ $license->total_seats }}</strong>
                        <span style="color: #64748b; font-size: 8px;">({{ $utilization }}%)</span>
                    </td>
                    <td>
                        <span class="badge badge-{{ $license->renewal_status }}">
                            {{ str_replace('_', ' ', $license->renewal_status) }}
                        </span><br>
                        <span style="color: #64748b; font-size: 8px;">
                            {{ $license->renewal_date ? $license->renewal_date->format('M j, Y') : 'No expiry' }}
                        </span>
                    </td>
                    <td style="text-align: right; font-weight: bold;">
                        PHP {{ number_format($license->annualized_cost, 2) }}
                    </td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <div class="footer">
        Generated automatically by ITFleet Enterprise ITAM Platform &bull; ISO 19770-1 IT Asset Compliance Standard &bull; Page 1 of 1
    </div>
</body>
</html>
