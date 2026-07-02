// Test Wandbox compilation endpoint
fetch("https://wandbox.org/api/list.json")
.then(res => res.json())
.then(list => {
  // Let's filter compilers for Java and Go
  const javaCompilers = list.filter(c => c.language.toLowerCase().includes("java"));
  const goCompilers = list.filter(c => c.language.toLowerCase().includes("go"));
  console.log("Java compilers:", javaCompilers.map(c => c.name));
  console.log("Go compilers:", goCompilers.map(c => c.name));
})
.catch(console.error);
