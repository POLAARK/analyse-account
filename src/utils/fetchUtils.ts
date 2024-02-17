import fetch from 'node-fetch';
import fs from 'fs';
import puppeteer, { Browser, HTTPResponse, Page } from 'puppeteer';
import { Http2SecureServer } from 'http2';

export const fetchhttpJsonPuppeteer = async function(url: string, jsonRequestUrl : string) : Promise<any> {

    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();
    // Enable request interception
    await page.setRequestInterception(true);

    page.on('request', (request) => {
        request.continue();
    });
    // Listen for 'response' events
    page.on('response', async (response) => {
        const requestUrl = response.url();
        // const contentType = response.headers()['content-type'];
    
        // Check if the URL matches the desired pattern and the content type is JSON 'https://api.debank.com/history/list?user_addr='
        if (
            requestUrl.startsWith(jsonRequestUrl)
        ) {
        try {
            const content = await response.json();
            return content;
        }
        catch (err) {
            console.log(' Pref light request Erreur ');
        }
        }
    });

    // Navigate to the target URL
    await page.goto(url);
    new Promise(r => setTimeout(r, 10000));
    // Close the browser
    // await browser.close();

}

export const fetchhttpJsonPuppeteerTokenAnalysor = async function(url: string, jsonRequestUrl : string,  browser: Browser, page: Page) : Promise<any> {
    const divSelector = `div[data-id="0xca3f508b8e4dd382ee878a314789373d80a5190a"][data-name="BIFI"][data-token-chain="bsc"]`;
    await page.setRequestInterception(true);

    // Listen for 'response' events
    page.on('response', async (response) => {
        const requestUrl = response.url();
        // const contentType = response.headers()['content-type'];
    
        // Check if the URL matches the desired pattern and the content type is JSON 'https://api.debank.com/history/list?user_addr='
        if (
            requestUrl.startsWith(jsonRequestUrl)
        ) {
        try {
            const content = await response.json();
            return content;
        }
        catch (err) {
            console.log(' Pref light request Erreur ');
        }
        }
    });

    // Navigate to the target URL
    await page.goto(url);
    new Promise(r => setTimeout(r, 20000));
    // Close the browser
    // await browser.close();

}

export const fetchhttpJsonPuppeteerLoadNewPage = async function(url: string, jsonRequestUrl : string) : Promise<any> {

    // Launch the browser
    const browser = await puppeteer.launch({ headless: true});
    const page = await browser.newPage();

    // Enable request interception
    await page.setRequestInterception(true);

    // Listen for 'response' events
    page.on('response', async (response) => {
        const requestUrl = response.url();
        // const contentType = response.headers()['content-type'];
    
        // Check if the URL matches the desired pattern and the content type is JSON 'https://api.debank.com/history/list?user_addr='
        if (
            requestUrl.startsWith(jsonRequestUrl)
        ) {
        try {
            const content = await response.json();
            return content;
        }
        catch (err) {
            console.log(' Pref light request Erreur ');
        }
        }
    });

    // Navigate to the target URL
    await page.goto(url);
    new Promise(r => setTimeout(r, 20000));
    // Close the browser
    // await browser.close();

}


export const fetchJsonFile = function(path: string): any {
    const contentFile = fs.readFileSync(path, 'utf-8');
    const jsonParse = JSON.parse(contentFile);

    return jsonParse;
}

export const fetchHttp = async function(url: string, header={}): Promise<string> {
    const response = await fetch(url, header);
    const body = await response.text();

    return body;
}

export const fetchHttpJson = async function(url: string, header={}): Promise<any> {
    let body: unknown;
    const response = await fetch(url, header);
    
    try {
        body = await response.json();
    }
    catch (err) {
        console.log(response);
        let resp : string = await response.text();
        throw new Error(`Can't generate proper response from ${url}`);
    }
    return body;
}

export const fetchHttpJsonHandlingTooManyRequest = async function(url: string, count : number = 0, header={}): Promise<any> {
    let body: unknown;
    const response = await fetch(url, header);
    let counter : number = count;
    if (response.statusText == 'Too Many Requests'){
        while ( counter < 10){
            counter += 1;
            await new Promise(resolve => setTimeout(resolve, 60000));
            return fetchHttpJsonHandlingTooManyRequest(url, counter);
        }
        return {message : 'Too Many Requests'}
    }
    try {
        body = await response.json();
    }
    catch (err) {
        console.log(response);
        let resp : string = await response.text();
        throw new Error(`Can't generate proper response from ${url}`);
    }
    return body;
}


export const makeDirectory = function(path: string): void {
    if(!fs.existsSync(path))
        fs.mkdirSync(path, { recursive: true });
}

export const writeFile = function(path: string, data: string): void {
    fs.writeFile(path, data, err => {
        if (err) {
          console.error(err);
          return;
        }
    });
}


export const isOccurenceInString = function isString(firstString : string, secondString : string[] | string) {
    if (typeof secondString === 'string'){
        return( firstString.toLowerCase().includes(secondString.toLowerCase()) )
    }
    else {
        for (let str of secondString) {
            if (firstString.toLowerCase().includes(str.toLowerCase())){
                return true
            }
        }
        return false;
    }
}