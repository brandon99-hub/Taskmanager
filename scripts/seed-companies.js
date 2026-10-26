const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Current clients, with details taken from each organisation's own published pages (researched
// 2026-10-26). Anything that could not be confirmed from an authoritative source is left null on
// purpose rather than guessed - a wrong email domain would route the wrong people's mail to a
// company. Fill the gaps in Companies > Edit; re-running this script never overwrites a value
// that is already set, so manual edits are safe.
//
// Akili Dada, Digrio Traders and YDX were confirmed by the team from each company's own contact
// page (akilidada.org/contact, digriotraders.com/policies/contact-information, ydx.co.ke).
// Assumption: "Privitazation" is the Privatization Commission of Kenya (pc.go.ke).
const COMPANIES = [
  {
    name: 'Kianda School',
    email: 'info@kiandaschool.ac.ke',
    phone: '+254 20 807 7381',
    address: 'Kabarsiran Avenue, off Waiyaki Way, Westlands, Nairobi. P.O. Box 48328-00100 GPO, Nairobi',
    emailDomain: 'kiandaschool.ac.ke',
  },
  {
    name: 'Kasneb',
    email: 'info@kasneb.or.ke',
    phone: '+254 20 4923000',
    address: 'Kasneb Towers, Hospital Road, Upper Hill. P.O. Box 41362-00100, Nairobi',
    emailDomain: 'kasneb.or.ke',
  },
  {
    name: 'Majani Insurance Brokers',
    email: 'wecare@majaninsure.com',
    phone: '+254 709 619 000',
    address: '5th Floor, Chai House, Koinange Street, Nairobi',
    emailDomain: 'majaninsure.com',
  },
  {
    name: 'Akili Dada',
    email: 'info@akilidada.org',
    phone: '+254 721 552 120',
    address: 'Suite B7, Saachi Plaza, Argwings Khodhek Road, Nairobi',
    emailDomain: 'akilidada.org',
  },
  {
    name: 'FSD Africa',
    email: 'info@fsdafrica.org',
    phone: '+254 20 402 4000',
    address: 'Riverside Green Suites, Riverside Drive. P.O. Box 5980-00100, Nairobi',
    emailDomain: 'fsdafrica.org',
  },
  {
    name: 'Digrio Traders',
    email: 'marketing@digriotraders.com',
    phone: '+254 722 208 738',
    address: 'Nairobi 68369, Kenya',
    emailDomain: 'digriotraders.com',
  },
  {
    name: 'Britam',
    email: 'customerservice@britam.com',
    phone: '+254 705 100 100',
    address: 'Britam Tower, Hospital Road, Upper Hill. P.O. Box 30375-00100, Nairobi',
    emailDomain: 'britam.com', // also covers ke.britam.com and other subdomains
  },
  {
    name: 'Privatization Commission',
    address: 'P.O. Box 34542-00100, Nairobi',
    emailDomain: 'pc.go.ke',
  },
  {
    name: 'YDX Marketing Agency',
    email: 'info@ydx.co.ke',
    phone: '+254 742 891 950',
    address: 'Rose Avenue, Nairobi',
    emailDomain: 'ydx.co.ke',
  },
];

// Same rules as server/utils/emailDomain.ts, kept inline so this script stays standalone.
const FREE_MAIL = new Set(['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com']);
function cleanDomain(raw) {
  if (!raw) return null;
  const domain = String(raw).trim().toLowerCase().replace(/^@/, '').replace(/^www\./, '');
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(domain) || FREE_MAIL.has(domain)) {
    throw new Error(`Invalid email domain in seed data: "${raw}"`);
  }
  return domain;
}

async function seed() {
  const client = await pool.connect();
  const created = [];
  const updated = [];
  const warnings = [];

  try {
    await client.query('BEGIN');

    for (const company of COMPANIES) {
      const domain = cleanDomain(company.emailDomain);

      // A domain can identify only one company; never take one that is already assigned elsewhere.
      let domainToSet = domain;
      if (domain) {
        const clash = await client.query(
          'SELECT name FROM companies WHERE email_domain = $1 AND lower(name) <> lower($2)',
          [domain, company.name]
        );
        if (clash.rowCount > 0) {
          warnings.push(`${company.name}: domain ${domain} is already assigned to "${clash.rows[0].name}", left unset`);
          domainToSet = null;
        }
      }

      const existing = await client.query('SELECT id FROM companies WHERE lower(name) = lower($1)', [company.name]);

      if (existing.rowCount === 0) {
        await client.query(
          `INSERT INTO companies (name, primary_contact_email, primary_contact_phone, address, email_domain)
           VALUES ($1, $2, $3, $4, $5)`,
          [company.name, company.email || null, company.phone || null, company.address || null, domainToSet]
        );
        created.push(company.name);
      } else {
        // Fill blanks only - values an admin already entered are left alone.
        await client.query(
          `UPDATE companies SET
             primary_contact_email = COALESCE(NULLIF(primary_contact_email, ''), $2),
             primary_contact_phone = COALESCE(NULLIF(primary_contact_phone, ''), $3),
             address = COALESCE(NULLIF(address, ''), $4),
             email_domain = COALESCE(NULLIF(email_domain, ''), $5),
             updated_at = NOW()
           WHERE id = $1`,
          [existing.rows[0].id, company.email || null, company.phone || null, company.address || null, domainToSet]
        );
        updated.push(company.name);
      }
    }

    await client.query('COMMIT');

    console.log(`Created ${created.length}: ${created.join(', ') || '-'}`);
    console.log(`Already existed (blanks filled in): ${updated.length}: ${updated.join(', ') || '-'}`);
    warnings.forEach((w) => console.warn(`WARNING: ${w}`));

    const noDomain = await client.query(
      `SELECT name FROM companies WHERE email_domain IS NULL OR email_domain = '' ORDER BY name`
    );
    if (noDomain.rowCount > 0) {
      console.log(`\nNo email domain yet (emails from these will NOT create tickets until set): ${noDomain.rows.map((r) => r.name).join(', ')}`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Company seed failed, rolled back:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
