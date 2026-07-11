---
name: wireframe-generator
description: Generate a low-fidelity wireframe / layout structure for a screen from its requirements. Use to define regions, hierarchy, and content blocks before any high-fidelity design or component implementation.
version: 1.0.0
category: design
tags:
  - wireframe
  - layout
  - low-fidelity
  - information-architecture
  - ux
model: inherit
invokes: []
inputs:
  - screen_requirements
outputs:
  - wireframe
---

# Goal

Generate a **low-fidelity wireframe** for a single screen from its requirements:
the layout regions, content hierarchy, and placement of key elements — without
color, real copy, or component styling.

This skill produces a **design artifact** (structural blueprint), **not code and
not high-fidelity visuals**. It defines *where things go and why*; the
`design-system-generator` provides the styled primitives, and
`web/layout-generator` + `component-generator` implement the actual screen.
A wireframe here answers "what regions and blocks does this screen have", not
"what does the final pixel-perfect UI look like".

# Inputs

```yaml
screen_requirements:
  screen: user-list
  purpose: "browse, search, and manage users"
  primary_actions: [create user, search, filter by role]
  data_shown: [name, email, role, status, last active]
  device: desktop         # desktop | mobile | responsive
  constraints: ["table must support pagination", "actions per row"]
```

# Output

```yaml
wireframe:
  screen: <name>
  device: <target>
  layout: <grid/region description>
  regions:
    - { id, role, contents, notes }
  hierarchy: <primary -> secondary -> tertiary emphasis>
  content_blocks: <placeholder blocks, no real copy>
  ascii_or_tree: <textual low-fi representation>
  annotations: <behavioral notes for the implementer>
```

# Workflow

## Step 1 — Identify regions

From requirements, decompose the screen into regions (header/toolbar, sidebar,
main content, detail panel, footer) and choose a layout grid appropriate to
`device`.

## Step 2 — Place content blocks

Assign each required data element and action to a region as a low-fidelity block
(placeholder rectangles/labels, no real copy or color). Establish visual
hierarchy: primary action prominent, secondary actions grouped.

## Step 3 — Represent structurally

Emit a textual low-fidelity representation (ASCII sketch or region tree) so the
structure is reviewable without a design tool.

## Step 4 — Annotate behavior

Add annotations for responsive behavior, empty/loading states, and interaction
hints that the layout/component generators will need. Keep it structural.

# Rules

- Low fidelity only: no color, no final typography, no real copy — placeholders.
- Produce structure/layout, not styled components or code
  (`layout-generator` / `component-generator` implement).
- Do NOT define design tokens or variant scales (those are the token/design-system
  generators).
- Cover empty, loading, and error placeholders where the screen implies data.
- One screen per invocation; multi-screen navigation is `ux-flow-generator`.
- Represent output textually (ASCII or tree) so it is reviewable in plain text.

# Examples

Input:

```yaml
screen_requirements:
  screen: user-list
  purpose: "browse, search, and manage users"
  primary_actions: [create user, search, filter by role]
  data_shown: [name, email, role, status, last active]
  device: desktop
```

Output (abridged):

```yaml
wireframe:
  screen: user-list
  device: desktop
  layout: "single-column, full-width; toolbar over data table"
  regions:
    - { id: header, role: page-header, contents: ["Title: Users", "[+ New User] primary button"] }
    - { id: toolbar, role: filters, contents: ["[search input]", "[role filter select]"] }
    - { id: table, role: main, contents: ["columns: name,email,role,status,last active", "row actions: edit/delete"] }
    - { id: footer, role: pagination, contents: ["<prev  1 2 3  next>", "rows-per-page select"] }
  hierarchy: "New User (primary) > search/filter (secondary) > row actions (tertiary)"
  annotations:
    - "empty state: illustration + 'No users yet' + New User CTA"
    - "loading: skeleton rows"
```

ASCII sketch:

```text
+------------------------------------------------------+
|  Users                              [ + New User ]   |
+------------------------------------------------------+
| [ search... ]        [ role v ]                      |
+------------------------------------------------------+
| Name    | Email        | Role  | Status | Last | ... |
| ------- | ------------ | ----- | ------ | ---- | ... |
| [ ]     | [          ] | [   ] | [    ] | [  ] | ... |
+------------------------------------------------------+
|                 < prev  1 2 3  next >   [ rows: 20 ] |
+------------------------------------------------------+
```
