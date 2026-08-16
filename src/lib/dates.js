export const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export const today   = new Date();
export const fmt     = d => d.toISOString().split("T")[0];
export const addDays = (d,n) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; };
export const formatDate = str => new Date(str+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
export const formatDateLong = str => new Date(str+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
