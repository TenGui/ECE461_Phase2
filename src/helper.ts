/*
  Original Author: Chuhan Lin
  Date edit: 9/7/2023
  File description: This file will store all helper functions that we will use to
  simplify our project
*/

import axios, { AxiosError } from 'axios';

async function get_api_url(repositoryUrl: string): Promise<string | null> {
/*
  args: string (github repo URL)
  return: string (github API)

  Description: The function takes in a github repository URL and outputs the 
  github API URL. It will test the API URL and if a response is succesful, it
  will return the URL or else it returns an empty string.
*/
  try {
    //Get repo owner from url by doing some input cleaning
    const urlParts = repositoryUrl.split('/');
    const owner = urlParts[3];
    var repoName = urlParts[4];
    if(urlParts[4].endsWith(".git")){
      repoName = urlParts[4].substring(0 , urlParts[4].length-4);
    }

    const cleanedURL = 'https://api.github.com/repos/' + owner + '/' + repoName;

    //Make a GET request to the github api of the repo
    const response = await axios.get(cleanedURL);

    if (response.status === 200) {
      return cleanedURL;
    } 
    else{
      console.error(cleanedURL + ' is not a valid github API');
      return "";
    }
  } 
  catch (error) {
    // Use type assertion to specify the type of the error object
    const axiosError = error as AxiosError;
    console.error('Error fetching repository information:', axiosError.message);
    return null;
  }
}


// Example usage
const repositoryUrl = 'https://github.com/clin8328/ECE461-Team4.git'; // Replace with the actual repository URL
get_api_url(repositoryUrl)
  .then((repositoryData) => {
    console.log(repositoryData)
  })
  .catch((error) => {
    console.error('Error:', error);
  });


