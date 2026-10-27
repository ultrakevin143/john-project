# Water Utility Data Hub

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js App Router, TypeScript, Tailwind CSS and shadcn-style Radix primitives. Express, Prisma and PostgreSQL in a modular monolith.

## Users

Water-district administrators, plant operators, billing analysts, laboratory analysts, field supervisors, integration operators and data stewards.

## Product Purpose

Trace source data through governed integration into operational records, water-quality checks, leak response and non-revenue water analysis.

## Capabilities and Constraints

The supplied PROJECT_PLAN.md defines the MVP. The user confirmed water-quality breaches and active leaks lead the overview, and chose the network-atlas workspace. This project must have a different design from the parent Waste Hub. The Cebu adaptation uses four selected Cebu City barangays with fictional supply zones, Manila calendar periods, PHP water-charge versions and four sourced PNSDW 2017 reference parameters. It is an independent prototype, not an MCWD system. Rates and operational sampling reminders are illustrative; live providers, regulatory certification and a complete compliance programme are outside the prototype. The user authorized a separate Neon runtime database and requested empty operational tables while preserving accounts and tables. All tests and populated demos use independent local PostgreSQL.

## Product Principles

1. Every metric has a period, unit and record-level lineage.
2. Domain permissions and organization boundaries are enforced by the backend.
3. Quarantine errors and retry only selected failed records.
4. Distinguish operational breaches from data validity and explain quality scores.

## Accessibility & Inclusion

Keyboard controls, focus visibility, status words, responsive navigation and meaningful table headings.
