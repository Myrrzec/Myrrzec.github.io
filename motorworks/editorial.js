const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.manifesto h2,.manifesto-bottom,.closing>a').forEach(el=>{el.classList.add('reveal');observer.observe(el)});
if(!reduced){let busy=false;addEventListener('scroll',()=>{if(busy)return;busy=true;requestAnimationFrame(()=>{const y=scrollY;const hero=document.querySelector('.hero-scene');if(y<hero.offsetHeight){document.querySelector('.hero-image').style.transform=`translateY(${y*.18}px) scale(${1+y*.00012})`;document.querySelector('h1').style.transform=`translateY(${-y*.12}px)`}busy=false})},{passive:true})}
// The 3D studio loads on intent: hovering or focusing the button fetches the code, clicking opens it.
const explore=document.querySelector('#explore');const studio=()=>import('./explore.js');
for(const type of ['pointerenter','focus','touchstart'])explore.addEventListener(type,()=>studio().catch(()=>{}),{once:true,passive:true});
explore.addEventListener('click',async()=>{try{(await studio()).enter()}catch{const note=document.querySelector('#explore-note');note.hidden=false;note.textContent="The 3D studio couldn't start. Please reload the page and try again."}});
// Every other "studio" link opens the same studio; ./#studio from another page opens it on arrival.
document.querySelectorAll('[data-studio]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();explore.click()}));
if(location.hash==='#studio'){history.replaceState(null,'',location.pathname+location.search);explore.click()}
