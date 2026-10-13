// Real calendar validation for YYYY-MM-DD inputs. "2026-02-30" or "2026-13-01" must not pass a shape-only regex.
export function isCalendarDate(value){
 if(typeof value!=='string')return false;
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
 if(!m)return false;
 const [year,month,day]=m.slice(1).map(Number);
 if(month<1||month>12||day<1)return false;
 const daysInMonth=new Date(Date.UTC(year,month,0)).getUTCDate();
 return day<=daysInMonth;
}
