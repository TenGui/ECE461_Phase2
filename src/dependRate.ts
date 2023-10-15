import { Octokit } from '@octokit/rest';
import { Metric } from './metric';

export class Depend_Score extends Metric {
    constructor(url: string) {
        super(url, "Depend_Score");
    }

    async calculateDependScore(): Promise<number> {
        const octokit = new Octokit({
            auth: this.githubToken // Put your GitHub token here
        });
        const _owner = this.repoOwner; // Obtain the owner of the repo
        const _repo = this.repoName; // Obtain the repo name

        try {
            const response = await octokit.request('GET /repos/{owner}/{repo}/contents/package.json', {
                owner: _owner,
                repo: _repo,
            });

            const packageJsonContent = Buffer.from(response.data.content, 'base64').toString();
            const packageJson = JSON.parse(packageJsonContent);
            const dependencies = packageJson.dependencies;

            if (!dependencies || Object.keys(dependencies).length === 0) {
                return 1.0;
            }

            let numPinnedDependencies = 0;
            let numTotalDependencies = 0;

            for (const dependency of Object.keys(dependencies)) {
                numTotalDependencies++;
                const version = dependencies[dependency];
                const versionParts = version.split('.');
                if (versionParts.length >= 2) {
                    const major = parseInt(versionParts[0]);
                    const minor = parseInt(versionParts[1]);
                    if (!isNaN(major) && !isNaN(minor)) {
                        if (version.match(new RegExp(`^${major}\\.${minor}\\.\\d+$`))) {
                            numPinnedDependencies++;
                        }
                    }
                }
            }

            return numPinnedDependencies / numTotalDependencies;
        } catch (error) {
            console.error('Error fetching package.json:', error);
            return 0;
        }
    }
}
