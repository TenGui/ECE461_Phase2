import * as git from 'isomorphic-git';
import fs from 'fs';
import path from 'path';
import { Metrics } from './types';
import { Logger } from 'loggin library'; 

export class Dependencies {
  private repoPath: string;
  private githubRepoUrl: string;
  private logger: Logger;

  constructor(repoPath: string, githubRepoUrl: string, logger: Logger) {
    this.repoPath = repoPath;
    this.githubRepoUrl = githubRepoUrl;
    this.logger = logger;
  }

  async cloneRepo(): Promise<boolean> {
    try {
      await git.clone({ fs, dir: this.repoPath, url: this.githubRepoUrl });
      this.logger.info(`Repository at ${this.githubRepoUrl} cloned successfully.`);
      return true;
    } catch (error) {
      this.logger.debug(`Error cloning repository at ${this.githubRepoUrl}:`, error);
      return false;
    }
  }

  readDependencies(): any {
    const packageJsonPath = path.join(this.repoPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const rawData = fs.readFileSync(packageJsonPath, 'utf-8');
      const jsonData = JSON.parse(rawData);
      return jsonData.dependencies || {};
    }
    return {};
  }

  deleteRepo(): void {
    fs.rmdirSync(this.repoPath, { recursive: true });
    this.logger.info(`Deleted repo at ${this.repoPath}`);
  }

  getDependencyMetrics(): Metrics {
    const dependencies = this.readDependencies();
  
    // Initialize your metrics
    let totalDependencies = 0;
    let pinnedDependencies = 0;
  
    // Calculate metrics based on the 'dependencies' object
    if (dependencies && 'dependencies' in dependencies) {
      totalDependencies = Object.keys(dependencies.dependencies).length;
  
      for (const [_, version] of Object.entries(dependencies.dependencies)) {
        // Check if a dependency is pinned to a specific major+minor version
        if (/^\d+\.\d+\.\d+$/.test(version)) {
          pinnedDependencies++;
        }
      }
    }
  
    // Handle the case where there are zero dependencies
    let score = totalDependencies === 0 ? 1.0 : (pinnedDependencies / totalDependencies);
  
    // Create your Metrics object
    const metrics: Metrics = {
      totalDependencies,
      pinnedDependencies,
      score
    };
  
    return metrics;
  }
  calculateScore(metrics: Metrics): number {
    let score = 0;
  
    // Hypothetical scoring logic
    score += metrics.totalDependencies * 2;
    score -= metrics.devDependencies;
  
    return score;
  }


const deps = new Dependencies('./temp-repo', 'here goes git hub url', logger);

(async () => {
  if (await deps.cloneRepo()) {
    const metrics = deps.getDependencyMetrics();
    console.log(metrics);
    deps.deleteRepo();
  }
})();