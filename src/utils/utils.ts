import fetch from 'node-fetch';
import fs from 'fs';

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

export const isExistNetworksFile = function(path: string): boolean {
    return fs.existsSync(path);
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