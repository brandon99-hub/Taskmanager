const { Pool } = require('pg');
require('dotenv').config();

// Database connection - use same method as main app
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL must be set. Please check your environment variables.');
  process.exit(1);
}

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function updateContactDetails() {
  try {
    console.log('🔄 Starting contact details update...');

    // First try to update from matching prospects
    console.log('📋 Updating expected orders from prospects...');
    
    const expectedOrdersResult = await pool.query(`
      UPDATE marketing_expected_orders 
      SET 
        contact_person = prospects.contact_person,
        contact_number = prospects.contact_number,
        contact_email = prospects.contact_email,
        sector = COALESCE(prospects.sector_id, 'Unknown'),
        updated_at = NOW()
      FROM marketing_prospects AS prospects
      WHERE 
        marketing_expected_orders.organisation_name = prospects.client 
        AND marketing_expected_orders.marketer_id = prospects.bd_id
        AND (marketing_expected_orders.contact_person IS NULL OR marketing_expected_orders.contact_person = '')
    `);

    console.log(`✅ Updated ${expectedOrdersResult.rowCount} expected orders from prospects`);

    // For remaining records without contact details, set reasonable defaults
    console.log('📋 Setting default contact details for remaining expected orders...');
    
    const defaultExpectedOrdersResult = await pool.query(`
      UPDATE marketing_expected_orders 
      SET 
        contact_person = 'Contact Person',
        contact_number = 'N/A',
        contact_email = 'contact@' || LOWER(REPLACE(organisation_name, ' ', '')) || '.com',
        updated_at = NOW()
      WHERE 
        contact_person IS NULL OR contact_person = ''
    `);

    console.log(`✅ Set default contact details for ${defaultExpectedOrdersResult.rowCount} expected orders`);

    // Update sales won with contact details from matching prospects
    console.log('🎯 Updating sales won records from prospects...');
    
    const salesWonResult = await pool.query(`
      UPDATE marketing_sales_won 
      SET 
        contact_person = prospects.contact_person,
        contact_number = prospects.contact_number,
        contact_email = prospects.contact_email,
        sector = COALESCE(prospects.sector_id, 'Unknown'),
        updated_at = NOW()
      FROM marketing_prospects AS prospects
      WHERE 
        marketing_sales_won.organisation_name = prospects.client 
        AND marketing_sales_won.marketer_id = prospects.bd_id
        AND (marketing_sales_won.contact_person IS NULL OR marketing_sales_won.contact_person = '')
    `);

    console.log(`✅ Updated ${salesWonResult.rowCount} sales won records from prospects`);

    // For remaining sales won records without contact details, set reasonable defaults
    console.log('🎯 Setting default contact details for remaining sales won records...');
    
    const defaultSalesWonResult = await pool.query(`
      UPDATE marketing_sales_won 
      SET 
        contact_person = 'Contact Person',
        contact_number = 'N/A',
        contact_email = 'contact@' || LOWER(REPLACE(organisation_name, ' ', '')) || '.com',
        updated_at = NOW()
      WHERE 
        contact_person IS NULL OR contact_person = ''
    `);

    console.log(`✅ Set default contact details for ${defaultSalesWonResult.rowCount} sales won records`);

    // Show results
    const expectedOrdersCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM marketing_expected_orders 
      WHERE contact_person IS NOT NULL AND contact_person != ''
    `);

    const salesWonCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM marketing_sales_won 
      WHERE contact_person IS NOT NULL AND contact_person != ''
    `);

    console.log('\n📊 Final Results:');
    console.log(`Expected Orders with contact details: ${expectedOrdersCount.rows[0].count}`);
    console.log(`Sales Won with contact details: ${salesWonCount.rows[0].count}`);

    console.log('\n✅ Contact details update completed!');
    
  } catch (error) {
    console.error('❌ Error updating contact details:', error);
  } finally {
    await pool.end();
  }
}

// Run the update
updateContactDetails();
