const rooms = [
  {code:"101",name:"한라",size:"22평",capacity:"기준 2인 · 최대 4인",desc:"넓은 거실이 있는 편안한 객실"},
  {code:"102",name:"올레",size:"22평",capacity:"기준 2인 · 최대 4인",desc:"여유로운 공간의 객실"},
  {code:"201",name:"감귤",size:"20평",capacity:"기준 2인 · 최대 3인",desc:"아늑한 오픈형 객실"},
  {code:"202",name:"돌담",size:"25평",capacity:"기준 4인 · 최대 6인",desc:"가족 여행에 좋은 객실"},
  {code:"301",name:"바당",size:"25평",capacity:"기준 4인 · 최대 6인",desc:"가족이 함께 머무르기 좋은 객실"},
  {code:"302",name:"월라",size:"20평",capacity:"기준 2인 · 최대 3인",desc:"편안한 오픈형 객실"},
  {code:"YU",name:"유채 독채",size:"22평",capacity:"인원 정보 확인 필요",desc:"넓은 테라스가 있는 독채"},
  {code:"DB",name:"동백 독채",size:"42평",capacity:"인원 정보 확인 필요",desc:"마당이 있는 독채"}
];
const grid=document.getElementById("roomGrid"), select=document.getElementById("roomSelect");
rooms.forEach(r=>{
  const option=document.createElement("option"); option.value=r.code; option.textContent=`${r.code} ${r.name} · ${r.size}`; select.append(option);
  const card=document.createElement("article"); card.className="room-card";
  card.innerHTML=`<div class="room-photo"><div class="placeholder-label">${r.name}</div></div><div class="room-info"><h3>${r.code==="YU"||r.code==="DB"?"":r.code+" "}${r.name}</h3><p>${r.desc}</p><div class="room-meta">${r.size}　·　${r.capacity}</div></div>`;
  grid.append(card);
});
const checkin=document.getElementById("checkin"), checkout=document.getElementById("checkout");
const today=new Date(); const localToday=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
checkin.min=localToday; checkout.min=localToday;
checkin.addEventListener("change",()=>{checkout.min=checkin.value; if(checkout.value && checkout.value<=checkin.value) checkout.value="";});
document.getElementById("menuToggle").addEventListener("click",()=>document.getElementById("mainNav").classList.toggle("open"));
document.querySelectorAll("#mainNav a").forEach(a=>a.addEventListener("click",()=>document.getElementById("mainNav").classList.remove("open")));

document.getElementById("bookingForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const form=e.currentTarget, msg=document.getElementById("formMessage"), btn=document.getElementById("submitBtn");
  const data=Object.fromEntries(new FormData(form).entries());
  if(data.checkout<=data.checkin){msg.textContent="체크아웃 날짜는 체크인 날짜보다 늦어야 합니다.";return;}
  if(!window.OASIS_CONFIG.gasWebAppUrl){msg.textContent="현재 예약 시스템 연결 준비 중입니다. 전화 또는 문의로 예약해 주세요.";return;}
  btn.disabled=true; btn.textContent="신청 접수 중...";
  try{
    const body=new URLSearchParams({...data,action:"createBookingRequest"});
    const response=await fetch(window.OASIS_CONFIG.gasWebAppUrl,{method:"POST",body});
    const result=await response.json();
    if(result.ok){msg.textContent=`예약 신청이 접수되었습니다. 예약번호: ${result.bookingId}. 관리자가 확인 후 연락드립니다.`;form.reset();}
    else msg.textContent=result.message||"신청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }catch(err){msg.textContent="연결에 실패했습니다. 관리자에게 전화로 문의해 주세요.";}
  finally{btn.disabled=false;btn.innerHTML='예약 신청하기 <span>→</span>';}
});
