---
name: chart-generator
description: Generate reusable data-visualization components with Recharts, keeping visualization separate from data fetching and following the project's design system.
version: 1.0.0
category: frontend
tags:
  - nextjs
  - react
  - chart
  - recharts
  - visualization
model: inherit
invokes:
  - typescript-senior-programmer
inputs:
  - chart_requirements
outputs:
  - chart_code
---

# Goal

Generate reusable chart components using **Recharts** as the charting library,
keeping visualization separate from data fetching. Delegates implementation to
`typescript-senior-programmer`.

# Inputs

```yaml
chart_requirements:
  name: RevenueChart
  chart_type: line   # line | bar | area | pie | scatter | composed
  data_shape: [{ date: string, revenue: number }]
  axes: { x: date, y: revenue }
  series: [revenue]
  interactions: [tooltip, legend]   # optional
  theme: default                    # optional
```

# Output

```yaml
chart_code:
  - chart component (Recharts) + types
  - data transformer (if required)
  - tooltip / legend / empty state / loading state
```

# Workflow

## Step 1 — Analyze visualization
Select the appropriate Recharts chart type for the data and intent.

## Step 2 — Design contract
Define the data shape, axis/series mapping, and the transformer from raw data.

## Step 3 — Delegate implementation
Delegate the Recharts component to `typescript-senior-programmer`.

## Step 4 — Validate
Confirm responsiveness (ResponsiveContainer) and accessible fallbacks.

# Rules

- Use Recharts for all charts; wrap in `ResponsiveContainer` for responsive layouts.
- Keep visualization separate from data fetching — accept data through Props.
- Provide empty and loading states; follow the project design system for colors.
- Reusable and composable; strict typing on data props.

# Examples

Input:

```yaml
chart_requirements: { name: RevenueChart, chart_type: line, axes: { x: date, y: revenue } }
```

Output (abridged):

```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface RevenuePoint { date: string; revenue: number; }

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  if (!data.length) return <p className="text-muted-foreground">No data</p>;
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data}>
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```
