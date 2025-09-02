-- Create contracts table
CREATE TABLE IF NOT EXISTS contracts (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_number VARCHAR(50) NOT NULL UNIQUE,
    project_id VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    client_name VARCHAR(200) NOT NULL,
    client_email VARCHAR(200) NOT NULL,
    client_phone VARCHAR(50),
    client_address TEXT,
    contract_type VARCHAR(20) NOT NULL, -- fixed_price, time_materials, milestone_based
    total_value DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'KES',
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, pending_approval, approved, active, completed, terminated
    signed_date TIMESTAMP,
    created_by VARCHAR NOT NULL REFERENCES users(id),
    project_scope TEXT,
    deliverables JSONB, -- Array of deliverable items
    payment_terms TEXT,
    special_clauses JSONB, -- Array of special clauses
    responsibilities JSONB, -- Object with client and contractor responsibilities
    timeline JSONB, -- Array of timeline phases
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_contracts_project_id ON contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_created_by ON contracts(created_by);
CREATE INDEX IF NOT EXISTS idx_contracts_created_at ON contracts(created_at);

-- Add some sample data (optional)
INSERT INTO contracts (
    contract_number,
    project_id,
    client_name,
    client_email,
    contract_type,
    total_value,
    currency,
    start_date,
    end_date,
    status,
    created_by,
    project_scope,
    deliverables,
    payment_terms,
    special_clauses,
    responsibilities
) VALUES (
    'CON-2025-0001',
    (SELECT id FROM projects LIMIT 1),
    'Sample Client Ltd',
    'client@sample.com',
    'fixed_price',
    500000.00,
    'KES',
    '2025-01-01',
    '2025-06-30',
    'draft',
    (SELECT id FROM users WHERE role = 'admin' LIMIT 1),
    'Development of a comprehensive project management system with advanced features including task tracking, team collaboration, and reporting capabilities.',
    '["System Requirements Document", "Technical Architecture", "Database Design", "Frontend Application", "Backend API", "User Documentation", "Deployment Guide"]',
    'Payment to be made in 3 installments: 40% upon contract signing, 40% at project midpoint, and 20% upon completion and acceptance.',
    '["All intellectual property rights remain with the client", "Confidentiality agreement applies to all project information", "Change requests require written approval"]',
    '{"client": ["Provide business requirements", "Approve deliverables", "Provide access to systems", "Make timely payments"], "contractor": ["Deliver quality software", "Meet agreed timelines", "Provide technical support", "Maintain confidentiality"]}'
) ON CONFLICT (contract_number) DO NOTHING;
