import * as icons from 'lucide-react';
console.log('TrafficLight exists:', 'TrafficLight' in icons);
console.log('Available icons starting with T:', Object.keys(icons).filter(k => k.startsWith('T')));
