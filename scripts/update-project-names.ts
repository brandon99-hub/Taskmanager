import { db } from '../server/db';
import { projects } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function updateProjectNames() {
  try {
    console.log('🚀 Starting project name update...');
    
    // Get all projects
    const allProjects = await db.select().from(projects).execute();
    console.log(`📊 Found ${allProjects.length} projects to process`);
    
    let updatedCount = 0;
    
    for (const project of allProjects) {
      // If project has a client name but no project name, or if they're different
      if (project.client && (!project.name || project.name !== project.client)) {
        try {
          // Update the project to use client name as the project name
          await db.update(projects)
            .set({ 
              name: project.client,
              updatedAt: new Date()
            })
            .where(eq(projects.id, project.id))
            .execute();
          
          console.log(`✅ Updated project ${project.id}: "${project.name || 'unnamed'}" → "${project.client}"`);
          updatedCount++;
        } catch (error) {
          console.error(`❌ Failed to update project ${project.id}:`, error);
        }
      } else if (!project.client && project.name) {
        // If project has a name but no client, set client to the name
        try {
          await db.update(projects)
            .set({ 
              client: project.name,
              updatedAt: new Date()
            })
            .where(eq(projects.id, project.id))
            .execute();
          
          console.log(`✅ Set client for project ${project.id}: "${project.name}"`);
          updatedCount++;
        } catch (error) {
          console.error(`❌ Failed to set client for project ${project.id}:`, error);
        }
      }
    }
    
    console.log(`🎉 Successfully updated ${updatedCount} projects`);
    
    // Verify the updates
    console.log('\n🔍 Verifying updates...');
    const updatedProjects = await db.select().from(projects).execute();
    
    const projectsWithClient = updatedProjects.filter(p => p.client);
    const projectsWithName = updatedProjects.filter(p => p.name);
    
    console.log(`📊 Projects with client names: ${projectsWithClient.length}`);
    console.log(`📊 Projects with project names: ${projectsWithName.length}`);
    
    // Show some sample updated projects
    const sampleProjects = updatedProjects.slice(0, 5);
    console.log('\n👤 Sample updated projects:');
    sampleProjects.forEach(project => {
      console.log(`  - ID: ${project.id}`);
      console.log(`    Name: ${project.name || 'N/A'}`);
      console.log(`    Client: ${project.client || 'N/A'}`);
      console.log(`    Segment: ${project.segment || 'N/A'}`);
      console.log('    ---');
    });
    
  } catch (error) {
    console.error('❌ Error during project name update:', error);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    await updateProjectNames();
    console.log('\n✨ Project name update completed successfully!');
  } catch (error) {
    console.error('\n💥 Project name update failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
console.log('🔧 Starting project name update script...');
main();
