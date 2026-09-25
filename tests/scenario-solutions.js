// Staff-only solutions for regression checks; not inserted into student editors.
export const scenarioSolutions = {
  sequence:'for(var x=0;x<columns();x++){bot.till();bot.plant("corn");bot.water();bot.wait(1);bot.water();bot.wait(1);bot.harvest();if(x<columns()-1)bot.right();}',
  clinic:'for(var x=0;x<columns();x++){if(bot.is_dead()){bot.destroy();}else if(bot.is_harvestable()){bot.harvest();}else{bot.water();}if(x<columns()-1)bot.right();}',
  irrigation:'for(var x=0;x<columns();x++){bot.water();if(x<columns()-1)bot.right();}',
  greedy:'for(var n=0;n<columns();n++){var best=-1;var priority=-1;for(var x=0;x<columns();x++){var t=bot.crop_time_left(x,0);if(t>0){var p=bot.crop_value(x,0)/t;if(p>priority){priority=p;best=x;}}}bot.jump(best,0);bot.harvest();}',
  planning:'var a=-1,b=-1,best=0;for(var i=0;i<columns();i++){var v=bot.crop_value(i,0);if(v>0&&i+1<=4&&v>best){best=v;a=i;b=-1;}for(var j=0;j<columns();j++){var w=bot.crop_value(j,0);if(i!==j&&v>0&&w>0&&i+Math.abs(j-i)+2<=4&&v+w>best){best=v+w;a=i;b=j;}}}if(a>=0){bot.jump(a,0);bot.harvest();}if(b>=0){bot.jump(b,0);bot.harvest();}',
};
