class Prjct < Formula
  desc "AI-integrated project management for indie hackers"
  homepage "https://prjct.app"
  url "https://github.com/jlopezlira/prjct-cli/archive/refs/tags/v0.4.0.tar.gz"
  sha256 "" # Will be updated by release workflow
  license "MIT"

  depends_on "node@18"

  def install
    # Install Node.js dependencies
    system "npm", "install", *std_npm_args(libexec)

    # Install all files to libexec
    libexec.install Dir["*"]

    # Create symlink for the binary
    (bin/"prjct").write_env_script libexec/"bin/prjct", PATH: "#{Formula["node@18"].opt_bin}:$PATH"

    # Create global data directory
    (var/"prjct-cli").mkpath
  end

  def post_install
    # Run setup script to configure MCP and create templates
    ohai "Running prjct setup..."
    system libexec/"scripts/setup.sh"

    # Create symlink in ~/.local/bin for direct access
    local_bin = "#{Dir.home}/.local/bin"
    FileUtils.mkdir_p(local_bin) unless Dir.exist?(local_bin)

    symlink_path = "#{local_bin}/prjct"
    File.delete(symlink_path) if File.exist?(symlink_path) || File.symlink?(symlink_path)
    File.symlink(bin/"prjct", symlink_path)

    ohai "Installation complete! Run 'prjct init' to get started."
  end

  def caveats
    <<~EOS
      prjct has been installed!

      Quick Start:
        1. Initialize your project:
           cd your-project && prjct init

        2. Set your current task:
           prjct now "build awesome feature"

        3. Ship when done:
           prjct ship "awesome feature"

      For Claude Code integration, the commands are automatically
      installed and available as /p:* commands.

      Documentation: https://github.com/jlopezlira/prjct-cli
    EOS
  end

  test do
    # Test that the binary exists and can be executed
    assert_match "prjct", shell_output("#{bin}/prjct 2>&1", 1)

    # Test that required commands are available
    system bin/"prjct", "--help"
  end
end
