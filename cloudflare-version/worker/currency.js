const COUNTRY_CURRENCY={Pakistan:"PKR",India:"INR","United States":"USD","United Kingdom":"GBP",Canada:"CAD",Australia:"AUD","United Arab Emirates":"AED","Saudi Arabia":"SAR",Qatar:"QAR","New Zealand":"NZD",Germany:"EUR",France:"EUR",Spain:"EUR",Italy:"EUR",Netherlands:"EUR",Ireland:"EUR",Singapore:"SGD",Malaysia:"MYR",Turkey:"TRY",Japan:"JPY",China:"CNY",Bangladesh:"BDT",Nepal:"NPR","Sri Lanka":"LKR","South Africa":"ZAR",Nigeria:"NGN",Kenya:"KES"};
const FALLBACK={USD:1,PKR:280,INR:84,GBP:.79,EUR:.92,CAD:1.38,AUD:1.52,AED:3.6725,SAR:3.75,QAR:3.64,NZD:1.66,SGD:1.34,MYR:4.45,TRY:34,JPY:150,CNY:7.2,BDT:110,NPR:134,LKR:300,ZAR:18.2,NGN:1600,KES:129};
let rateCache=null,rateAt=0;
export const currencyForCountry=country=>COUNTRY_CURRENCY[country]||"PKR";
export async function fxRates(){if(rateCache&&Date.now()-rateAt<21600000)return rateCache;try{const r=await fetch("https://open.er-api.com/v6/latest/USD");const j=await r.json();if(j.result==="success"&&j.rates){rateCache=j.rates;rateAt=Date.now();return rateCache;}}catch{}return FALLBACK;}
export async function toUSD(value,currency){const rates=await fxRates(),rate=Number(rates[currency]||FALLBACK[currency]||1);return (Number(value)||0)/rate;}
export async function fromUSD(value,currency){const rates=await fxRates(),rate=Number(rates[currency]||FALLBACK[currency]||1);return Math.round((Number(value)||0)*rate);}
export function usdValue(profile,key){if(Number.isFinite(Number(profile[key+"_usd"])))return Number(profile[key+"_usd"]);const currency=profile.currency||"USD";return (Number(profile[key])||0)/(FALLBACK[currency]||1);}
