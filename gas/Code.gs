/**
 * 오아시스휴양펜션 예약 접수 백엔드
 * 1) Apps Script 프로젝트에 붙여넣기
 * 2) setupSheets()를 한 번 직접 실행하고 권한 승인
 * 3) 배포 > 새 배포 > 웹 앱 > 실행 사용자: 나 / 액세스: 모든 사용자
 *
 * 운영 전 반드시 개인정보 처리방침, 관리자 승인 인증, 예약 중복 처리 정책을 검토하세요.
 */
const SHEETS = { rooms:"객실", requests:"예약신청", bookings:"예약" };

function setupSheets(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss,SHEETS.rooms,["객실코드","객실명","평수","기준인원","최대인원","판매여부"]);
  ensureSheet_(ss,SHEETS.requests,["예약번호","신청일시","객실코드","체크인","체크아웃","성인","아동","예약자","연락처","요청사항","상태"]);
  ensureSheet_(ss,SHEETS.bookings,["예약번호","객실코드","체크인","체크아웃","예약자","연락처","상태","신청일시"]);
  const sh=ss.getSheetByName(SHEETS.rooms);
  if(sh.getLastRow()===1){
    sh.getRange(2,1,8,6).setValues([
      ["101","한라","22평",2,4,"판매"],
      ["102","올레","22평",2,4,"판매"],
      ["201","감귤","20평",2,3,"판매"],
      ["202","돌담","25평",4,6,"판매"],
      ["301","바당","25평",4,6,"판매"],
      ["302","월라","20평",2,3,"판매"],
      ["YU","유채 독채","22평",2,4,"판매"],
      ["DB","동백 독채","42평",4,8,"판매"]
    ]);
  }
}
function ensureSheet_(ss,name,headers){
  let sh=ss.getSheetByName(name); if(!sh) sh=ss.insertSheet(name);
  if(sh.getLastRow()===0) sh.appendRow(headers);
}
function doGet(e){
  return ContentService.createTextOutput(JSON.stringify({ok:true,service:"Oasis booking API",message:"예약 서비스가 실행 중입니다."}))
    .setMimeType(ContentService.MimeType.JSON);
}
function doPost(e){
  try{
    const p=e.parameter||{};
    if(p.action!=="createBookingRequest") throw new Error("지원하지 않는 요청입니다.");
    const result=createBookingRequest_(p);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }catch(err){
    return ContentService.createTextOutput(JSON.stringify({ok:false,message:err.message||"오류가 발생했습니다."}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
function createBookingRequest_(p){
  const required=["roomCode","checkin","checkout","adults","guestName","phone"];
  required.forEach(k=>{if(!String(p[k]||"").trim()) throw new Error("필수 항목을 입력해 주세요.");});
  const start=new Date(p.checkin+"T00:00:00"), end=new Date(p.checkout+"T00:00:00");
  if(isNaN(start)||isNaN(end)||end<=start) throw new Error("숙박 날짜를 확인해 주세요.");
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try{
    const ss=SpreadsheetApp.getActiveSpreadsheet(), roomSh=ss.getSheetByName(SHEETS.rooms);
    const roomRows=roomSh.getDataRange().getValues();
    const room=roomRows.slice(1).find(r=>String(r[0])===String(p.roomCode)&&String(r[5])==="판매");
    if(!room) throw new Error("선택한 객실은 현재 예약 신청을 받을 수 없습니다.");
    const people=Number(p.adults||0)+Number(p.children||0);
    if(people>Number(room[4])) throw new Error("선택한 객실의 최대 인원을 초과했습니다.");
    const occupied=getOccupied_(ss,p.roomCode);
    const overlap=occupied.some(b=>start < b.end && end > b.start);
    if(overlap) throw new Error("선택한 날짜에 예약 또는 확인 중인 신청이 있습니다. 다른 날짜를 선택해 주세요.");
    const id="OA"+Utilities.formatDate(new Date(),Session.getScriptTimeZone(),"yyMMddHHmmss")+"-"+Math.floor(Math.random()*900+100);
    ss.getSheetByName(SHEETS.requests).appendRow([id,new Date(),p.roomCode,p.checkin,p.checkout,Number(p.adults),Number(p.children||0),p.guestName,p.phone,p.memo||"","대기"]);
    return {ok:true,bookingId:id,status:"대기"};
  }finally{lock.releaseLock();}
}
function dateOnly_(v){\n  if(v instanceof Date) return new Date(v.getFullYear(),v.getMonth(),v.getDate());\n  const s=String(v); return new Date(s.slice(0,10)+"T00:00:00");\n}\nfunction getOccupied_(ss,roomCode,excludeBookingId){
  const ranges=[];
  [SHEETS.bookings,SHEETS.requests].forEach(name=>{
    const sh=ss.getSheetByName(name); if(!sh||sh.getLastRow()<2)return;
    const rows=sh.getDataRange().getValues().slice(1);
    rows.forEach(r=>{
      const status=String(name===SHEETS.bookings?r[6]:r[10]);
      if(String(r[name===SHEETS.bookings?1:2])!==String(roomCode))return;
      if(name===SHEETS.bookings && status!=="확정")return;
      if(name===SHEETS.requests && status!=="대기")return;
      ranges.push({start:dateOnly_(r[name===SHEETS.bookings?2:3]),end:dateOnly_(r[name===SHEETS.bookings?3:4])});
    });
  });
  return ranges;
}

/**
 * 관리자 승인: 스프레드시트에서 예약신청 행의 상태를 '승인'으로 바꾸는 대신,
 * 이 함수를 실행해 해당 예약을 확정 시트에 복사합니다.
 * 예약신청 시트에서 예약번호를 선택해 실행할 수 있도록 예약번호를 인자로 전달합니다.
 */
function approveBooking(bookingId){
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try{
    const ss=SpreadsheetApp.getActiveSpreadsheet(), req=ss.getSheetByName(SHEETS.requests);
    const rows=req.getDataRange().getValues(), idx=rows.findIndex((r,i)=>i>0&&String(r[0])===String(bookingId));
    if(idx<1) throw new Error("예약 신청을 찾을 수 없습니다.");
    const r=rows[idx]; if(String(r[10])!=="대기") throw new Error("대기 상태의 신청만 승인할 수 있습니다.");
    const start=new Date(r[3]+"T00:00:00"),end=new Date(r[4]+"T00:00:00");
    const occupied=getOccupied_(ss,r[2]).filter(x=>!(x.start.getTime()===start.getTime()&&x.end.getTime()===end.getTime()));
    if(occupied.some(b=>start<b.end&&end>b.start)) throw new Error("다른 예약과 일정이 겹칩니다.");
    ss.getSheetByName(SHEETS.bookings).appendRow([r[0],r[2],r[3],r[4],r[7],r[8],"확정",r[1]]);
    req.getRange(idx+1,11).setValue("승인");
    return "예약 확정 완료";
  }finally{lock.releaseLock();}
}
function rejectBooking(bookingId){
  const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.requests);
  const rows=sh.getDataRange().getValues(), idx=rows.findIndex((r,i)=>i>0&&String(r[0])===String(bookingId));
  if(idx<1) throw new Error("예약 신청을 찾을 수 없습니다.");
  sh.getRange(idx+1,11).setValue("거절");
  return "예약 거절 처리 완료";
}
