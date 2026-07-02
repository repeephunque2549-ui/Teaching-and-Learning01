// Test compilation on Wandbox
fetch("https://wandbox.org/api/compile.json", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    compiler: "openjdk-jdk-21+35",
    code: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Wandbox Java!");
        if (args.length > 0) {
            System.out.println("Args: " + String.join(", ", args));
        }
        try {
            java.util.Scanner sc = new java.util.Scanner(System.in);
            if (sc.hasNextLine()) {
                System.out.println("Stdin: " + sc.nextLine());
            }
        } catch(Exception e) {}
    }
}`,
    stdin: "Hello Stdin!"
  })
})
.then(res => res.json())
.then(console.log)
.catch(console.error);
