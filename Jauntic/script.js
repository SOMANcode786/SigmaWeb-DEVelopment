let icontheme = document.querySelector(".icontheme");
let body = document.querySelector("body");
let nav = document.querySelector(".nav");
let navanchors = document.querySelectorAll(".theme1");
let worktgts = document.querySelectorAll(".worktgts");
let html = document.querySelector(".light-theme");
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

    worktgts.forEach(worktgt => {
worktgt.style.color = "#f8f9fa";
      worktgt.style.backgroundColor = "#88b8e7ff"
      worktgt.classList.remove("btn-light");
  worktgt.classList.add("btn-dark");
    });

  html.classList.remove("light-theme");
  html.classList.add("dark-theme");
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
    worktgts.forEach(worktgt => {
   worktgt.style.color = "#000707ff";
      worktgt.style.backgroundColor = "transparent";
       worktgt.classList.remove("btn-dark");
  worktgt.classList.add("btn-light");
    });
  html.classList.remove("dark-theme");
 html.classList.add("light-theme");
    flag = 0;
    }
  
})

