package nfs

import (
	"testing"
)

func TestValidatePathsInText_AbsoluteUnixPath(t *testing.T) {
	line := "/srv/nfs/data *(rw,root_squash,sync)"
	errs := ValidatePathsInText(line, []string{"/srv"})
	if len(errs) > 0 {
		t.Fatalf("expected no errors for absolute Unix path, got %v", errs)
	}
}

func TestCleanExportPath_WindowsHost(t *testing.T) {
	cases := map[string]string{
		"/srv/nfs/data":  "/srv/nfs/data",
		"/srv/nfs/../x":  "/srv/x",
		"\\srv\\nfs\\data": "/srv/nfs/data",
	}
	for input, want := range cases {
		if got := CleanExportPath(input); got != want {
			t.Fatalf("CleanExportPath(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestIsAbsoluteExportPath(t *testing.T) {
	if !IsAbsoluteExportPath("/srv/nfs") {
		t.Fatal("expected /srv/nfs to be absolute")
	}
	if IsAbsoluteExportPath("srv/nfs") {
		t.Fatal("expected srv/nfs to be relative")
	}
}
