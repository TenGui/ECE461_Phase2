/*
  Original Author: Will Stonebridge
  Date edit: 9/9/2023

  Main is called by the run executable and gathers all of the metrics
*/

import process from 'process';
import {get_License_Metric} from './license';
import { getResponsiveness } from './responsiveness';
import * as fs from 'fs/promises';
import { get_api_url } from './helper';


async function evaluate_URL(url : string) {
  let metrics = {
    'URL_FILE' : url,
    'license' : -1,
    'bus factor' : -1,
    'responsiveness' : -1,
    'correctness' : -1,
    'ramp up' : -1,
    'overall' : -1
  };
  await get_License_Metric(url).then((metric) => {metrics['license'] = metric});
  await getResponsiveness(url).then((metric) => {metrics['responsiveness'] = metric});

  return metrics 
}

async function read_file(url: string) {
  try {
    const fileContent = await fs.readFile(url, 'utf-8');
    return fileContent;
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
}

async function main() {
  const url_file_path: string = process.argv[2]; //get the URL_FILE argument from the command line

  const fileContent = await read_file(url_file_path);
  const fileList = fileContent.split('\n');

  for (let link of fileList) {
    const response = await get_api_url(link);
    console.log("-------------------------------------------------");
    console.log(link)
    if(response != ""){
      const output = await evaluate_URL(link.substring(0,link.length-1));
      console.log(output);
    }
    break;
  }
  //TODO: read each url in here
  //let other_metrics = evaluate_URL('https://github.com/davisjam/safe-regex');
  //let metrics = evaluate_URL('https://github.com/cloudinary/cloudinary_npm');
  //console.log('evaluating second');
}

main();