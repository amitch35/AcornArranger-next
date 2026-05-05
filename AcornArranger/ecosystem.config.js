module.exports = {
    apps: [
      {
        name: "acornarranger-web",
        script: "npm",
        args: "start",
        env: {
          NODE_ENV: "production",
          PORT: 3001
        }
      }
    ]
  };
  