export function formatDecimal(value){
 const [whole,fraction='']=String(value).split('.');
 const grouped=whole.replace(/\B(?=(\d{3})+(?!\d))/g,',');
 return grouped+'.'+fraction.padEnd(2,'0');
}
