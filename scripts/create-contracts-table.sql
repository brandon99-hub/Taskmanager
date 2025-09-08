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


