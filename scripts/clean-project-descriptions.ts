import { db } from '../server/db';
import { projects } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function cleanProjectDescriptions() {
  try {
    console.log('🧹 Starting project description cleanup...');
    
    // Get all projects
    const allProjects = await db.select().from(projects).execute();
    console.log(`📊 Found ${allProjects.length} projects to process`);
    
    let updatedCount = 0;
    
    for (const project of allProjects) {
      if (project.description && project.client) {
        // Check if description contains the client name (which would be redundant)
        const description = project.description.trim();
        const client = project.client.trim();
        
        // If description is exactly the same as client name, clear it
        if (description === client) {
          try {
            await db.update(projects)
              .set({ 
                description: '', // Use empty string instead of null due to NOT NULL constraint
                updatedAt: new Date()
              })
              .where(eq(projects.id, project.id))
              .execute();
            
            console.log(`✅ Cleared redundant description for project ${project.id}: "${description}"`);
            updatedCount++;
          } catch (error) {
            console.error(`❌ Failed to clear description for project ${project.id}:`, error);
          }
        }
        // If description starts with client name followed by common separators, clean it up
        else if (description.startsWith(client + ' - ') || 
                 description.startsWith(client + ': ') ||
                 description.startsWith(client + ' – ')) {
          try {
            // Extract the part after the separator
            const cleanDescription = description.substring(client.length + 2).trim();
            
            if (cleanDescription) {
              await db.update(projects)
                .set({ 
                  description: cleanDescription,
                  updatedAt: new Date()
                })
                .where(eq(projects.id, project.id))
                .execute();
              
              console.log(`✅ Cleaned description for project ${project.id}: "${description}" → "${cleanDescription}"`);
            } else {
              // If nothing left after cleaning, set to empty string
              await db.update(projects)
                .set({ 
                  description: '', // Use empty string instead of null
                  updatedAt: new Date()
                })
                .where(eq(projects.id, project.id))
                .execute();
              
              console.log(`✅ Cleared empty description for project ${project.id}: "${description}"`);
            }
            updatedCount++;
          } catch (error) {
            console.error(`❌ Failed to clean description for project ${project.id}:`, error);
          }
        }
      }
    }
    
    console.log(`🎉 Successfully cleaned ${updatedCount} project descriptions`);
    
    // Verify the updates
    console.log('\n🔍 Verifying cleanup...');
    const updatedProjects = await db.select().from(projects).execute();
    
    const projectsWithDescription = updatedProjects.filter(p => p.description && p.description.trim() !== '');
    const projectsWithoutDescription = updatedProjects.filter(p => !p.description || p.description.trim() === '');
    
    console.log(`📊 Projects with descriptions: ${projectsWithDescription.length}`);
    console.log(`📊 Projects without descriptions: ${projectsWithoutDescription.length}`);
    
    // Show some sample cleaned projects
    const sampleProjects = updatedProjects.slice(0, 5);
    console.log('\n👤 Sample cleaned projects:');
    sampleProjects.forEach(project => {
      console.log(`  - ID: ${project.id}`);
      console.log(`    Client: ${project.client || 'N/A'}`);
      console.log(`    Description: ${project.description || 'N/A'}`);
      console.log('    ---');
    });
    
  } catch (error) {
    console.error('❌ Error during project description cleanup:', error);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    await cleanProjectDescriptions();
    console.log('\n✨ Project description cleanup completed successfully!');
  } catch (error) {
    console.error('\n💥 Project description cleanup failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
console.log('🔧 Starting project description cleanup script...');
main();
