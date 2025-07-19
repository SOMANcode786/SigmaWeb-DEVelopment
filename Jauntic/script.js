let icontheme = document.querySelector(".icontheme");
let body = document.querySelector("body");
let nav = document.querySelector(".nav");
let navanchors = document.querySelectorAll(".theme1");
let worktgt = document.querySelector(".main1 button");
    let flag = 0;



    icontheme.addEventListener("click",function(){
        if (!flag) {
          icontheme.src = "sun.png"
          body.style.backgroundColor = "black";
          body.style.color = "white";
          nav.style.backgroundColor = "#000000ff";
          navanchors.forEach(anchor => {
      anchor.style.color = "#f8f9fa";
      

   
    });

worktgt.style.color = "#f8f9fa";
      worktgt.style.backgroundColor = "#88b8e7ff"
      worktgt.classList.remove("btn-light");
  worktgt.classList.add("btn-dark");
    flag = 1;

    }
    else{
        icontheme.src = "dark.png"
          body.style.backgroundColor = "white";
          body.style.color = "black";
          nav.style.backgroundColor = "#f8f9fa";
 navanchors.forEach(anchor => {
      anchor.style.color = "#000707ff";
   

    });
   worktgt.style.color = "#000707ff";
      worktgt.style.backgroundColor = "transparent";
       worktgt.classList.remove("btn-dark");
  worktgt.classList.add("btn-light");

    flag = 0;
    }
  
})

