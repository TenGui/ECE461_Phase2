import process from 'process';
import {License} from './license';
import { Bus } from './busFactor';
import * as fs from 'fs/promises';
import { RampUp } from './rampup';
import { Correctness } from './correctness';
import { net_score } from './netScore';
import { Responsiveness } from './responsiveness';
import { Metric } from './metric';
import { check_api_limit } from './api_limit';
import { stat } from 'fs';
import { Depend_Score } from './dependRate';

require('dotenv').config();


export async function evaluate_URL(url: string) {
  /*
    args: string (github repo URL)
    return: ndjson

    Description: This is the function to call inside main that evaluates a given github url and
    returns 6 metrics analyzed from the package.
  */
  try {
    var metrics = {
      "URL" : url,
      "NET_SCORE": -1,
      "RAMP_UP_SCORE": -1,
      "CORRECTNESS_SCORE": -1,
      "BUS_FACTOR_SCORE": -1,
      "RESPONSIVE_MAINTAINER_SCORE": -1,
      "LICENSE_SCORE": -1,
      "DEPENDENCY_SCORE": -1,
    };

    let bus = new Bus(url);
    await bus.getGitHubRepoUrl(url);

    let correctness = new Correctness(url);
    await correctness.getGitHubRepoUrl(url);

    let rampup = new RampUp(url);
    await rampup.getGitHubRepoUrl(url);

    let lic = new License(url);
    await lic.getGitHubRepoUrl(url);

    let responsiveness = new Responsiveness(url);
    await responsiveness.getGitHubRepoUrl(url);

    let depend = new Depend_Score(url);
    await depend.getGitHubRepoUrl(url);

    let metric = new Metric(url,"test-clone");
    await metric.getGitHubRepoUrl(url);

    if(metric.status != 200){
      throw new Error();
    }

    await metric.cloneRepository();
    metrics["LICENSE_SCORE"] = await lic.Find_And_ReadLicense();
    metrics["RESPONSIVE_MAINTAINER_SCORE"] = Math.floor(await responsiveness.numCollaborators() * 100000) / 100000;
    metrics["BUS_FACTOR_SCORE"] = await bus.Bus_Factor(url);
    metrics["RAMP_UP_SCORE"] = await rampup.rampup();
    metrics["CORRECTNESS_SCORE"] = await correctness.getMetric();
    metrics["DEPENDENCY_SCORE"] = await depend.calculateDependScore();
    metrics["NET_SCORE"] = await net_score(metrics);
    await metric.deleteRepository();

    return metrics;

  } catch (error) {
    console.error(error);
    return {
      "URL" : url,
      "NET_SCORE": -1,
      "RAMP_UP_SCORE": -1,
      "CORRECTNESS_SCORE": -1,
      "BUS_FACTOR_SCORE": -1,
      "RESPONSIVE_MAINTAINER_SCORE": -1,
      "LICENSE_SCORE": -1,
      "DEPENDENCY_SCORE": -1,
    };
  }
}

export async function read_file(url: string): Promise<string> {
  /*
  args: string (file path)
  return: string (file content)

  Description: The function takes in a path to a file and reads the content of it
  */
  try {
    const fileContent = await fs.readFile(url, 'utf-8');
    return fileContent;
  } catch (error) {
    // console.error('Error reading file:', error);
    // throw error;
    process.exit(1);
  }
}

require('dotenv').config();

async function checkEnvironment() {
    try {
        // console.log(process.env.GITHUB_TOKEN)
        // console.log(process.env.LOG_FILE)
        // console.log(process.env.LOG_LEVEL)
        if(process.env.GITHUB_TOKEN === undefined || process.env.GITHUB_TOKEN === "\n") {
            throw new Error();
        }
        else if (process.env.LOG_FILE === undefined || process.env.LOG_FILE === "\n") {
            throw new Error()
        }
        else if(process.env.LOG_LEVEL === undefined || process.env.LOG_LEVEL === "\n") {
            process.env.LOG_LEVEL = '0';
        }
    } catch (error) {
        //console.error(error)
        console.log(process.env.LOG_FILE);
        process.exit(1);
    }
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const url_file_path: string = process.argv[2]; //get the URL_FILE argument from the command line
  const fileContent = await read_file(url_file_path);
  const fileList = fileContent.split('\n');

  
  await checkEnvironment();
  
  for (let link of fileList) {
    if(link == ""){
      continue;
    }

    const status = await check_api_limit();
    if(!status){
      await delay(60000);
    }

    var url_link = link.length;
    if(link.endsWith("\n") || link.endsWith("\r")){
      url_link = link.length-1;
    }

    const output = await evaluate_URL(link.substring(0,url_link));
    const jsonString = JSON.stringify(output);
    console.log(`${jsonString}`);

    await delay(500);

  }
  process.exit(0);
}

main();
