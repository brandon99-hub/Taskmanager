import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Machine identification utilities
 */

export interface MachineInfo {
  hostname: string;
  platform: string;
  arch: string;
  osVersion: string;
  machineId?: string;
  networkInterfaces: string[];
  cpuModel: string;
  totalMemory: string;
}

/**
 * Get machine identification information
 */
export async function getMachineInfo(): Promise<MachineInfo> {
  try {
    const hostname = os.hostname();
    const platform = os.platform();
    const arch = os.arch();
    const osVersion = os.release();
    const cpuModel = os.cpus()[0]?.model || 'Unknown';
    const totalMemory = `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`;
    
    // Get network interfaces
    const networkInterfaces = Object.keys(os.networkInterfaces())
      .filter(iface => {
        const details = os.networkInterfaces()[iface];
        return details?.some(detail => !detail.internal && detail.family === 'IPv4');
      })
      .map(iface => {
        const details = os.networkInterfaces()[iface];
        const ipv4 = details?.find(detail => !detail.internal && detail.family === 'IPv4');
        return `${iface}: ${ipv4?.address || 'N/A'}`;
      });

    // Try to get machine ID (works on Linux/Unix systems)
    let machineId: string | undefined;
    try {
      if (platform === 'linux') {
        const { stdout } = await execAsync('cat /etc/machine-id 2>/dev/null || cat /var/lib/dbus/machine-id 2>/dev/null || echo "unknown"');
        machineId = stdout.trim();
      } else if (platform === 'darwin') {
        const { stdout } = await execAsync('ioreg -rd1 -c IOPlatformExpertDevice | grep -E \'"(UUID)"\' | awk \'{print $3}\' | sed \'s/"//g\'');
        machineId = stdout.trim();
      } else if (platform === 'win32') {
        const { stdout } = await execAsync('wmic csproduct get uuid /value | findstr UUID');
        machineId = stdout.replace('UUID=', '').trim();
      }
    } catch (error) {
      // Machine ID not available
      machineId = undefined;
    }

    return {
      hostname,
      platform,
      arch,
      osVersion,
      machineId: machineId && machineId !== 'unknown' ? machineId : undefined,
      networkInterfaces,
      cpuModel,
      totalMemory
    };
  } catch (error) {
    console.error('Error getting machine info:', error);
    return {
      hostname: 'unknown',
      platform: 'unknown',
      arch: 'unknown',
      osVersion: 'unknown',
      networkInterfaces: [],
      cpuModel: 'unknown',
      totalMemory: 'unknown'
    };
  }
}

/**
 * Get a simplified machine identifier for logging
 */
export function getMachineIdentifier(): string {
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();
  
  return `${hostname} (${platform}-${arch})`;
}

/**
 * Get client machine info from request headers and user agent
 */
export function getClientMachineInfo(req: any): {
  clientHostname?: string;
  clientPlatform?: string;
  clientArch?: string;
  clientUserAgent: string;
  clientIP: string;
} {
  const userAgent = req.get('User-Agent') || 'unknown';
  const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
  
  // Try to extract client info from headers (if available)
  let clientHostname = req.get('X-Client-Hostname') || req.get('X-Forwarded-Host') || undefined;
  let clientPlatform = req.get('X-Client-Platform') || undefined;
  let clientArch = req.get('X-Client-Arch') || undefined;
  
  // If we don't have client info from headers, try to extract from User-Agent
  if (!clientPlatform || !clientArch) {
    const uaInfo = parseUserAgent(userAgent);
    clientPlatform = clientPlatform || uaInfo.platform;
    clientArch = clientArch || uaInfo.arch;
  }
  
  // Generate a meaningful hostname if we don't have one
  if (!clientHostname) {
    clientHostname = generateClientHostname(clientPlatform, clientArch);
  }
  
  return {
    clientHostname,
    clientPlatform,
    clientArch,
    clientUserAgent: userAgent,
    clientIP: ipAddress
  };
}

/**
 * Parse user agent to extract platform and architecture info
 */
function parseUserAgent(userAgent: string): { platform: string; arch: string } {
  const ua = userAgent.toLowerCase();
  
  let platform = 'Unknown Platform';
  let arch = 'Unknown Architecture';
  
  // Detect platform
  if (ua.includes('windows')) {
    platform = 'Windows';
    if (ua.includes('win64') || ua.includes('wow64')) {
      arch = 'x64';
    } else if (ua.includes('win32')) {
      arch = 'x86';
    }
  } else if (ua.includes('macintosh') || ua.includes('mac os')) {
    platform = 'macOS';
    if (ua.includes('intel') || ua.includes('x86_64')) {
      arch = 'x64';
    } else if (ua.includes('arm')) {
      arch = 'arm64';
    }
  } else if (ua.includes('linux')) {
    platform = 'Linux';
    if (ua.includes('x86_64')) {
      arch = 'x64';
    } else if (ua.includes('arm')) {
      arch = 'arm64';
    }
  } else if (ua.includes('android')) {
    platform = 'Android';
    arch = 'arm64';
  } else if (ua.includes('iphone') || ua.includes('ipad')) {
    platform = 'iOS';
    arch = 'arm64';
  }
  
  return { platform, arch };
}

/**
 * Generate a meaningful client hostname based on platform and architecture
 */
function generateClientHostname(platform?: string, arch?: string): string {
  const platformName = platform || 'Unknown';
  const archName = arch || 'Unknown';
  
  // Create a meaningful hostname
  if (platformName === 'Windows') {
    return `Windows-${archName}`;
  } else if (platformName === 'macOS') {
    return `Mac-${archName}`;
  } else if (platformName === 'Linux') {
    return `Linux-${archName}`;
  } else if (platformName === 'Android') {
    return `Android-${archName}`;
  } else if (platformName === 'iOS') {
    return `iOS-${archName}`;
  } else {
    return `${platformName}-${archName}`;
  }
}
