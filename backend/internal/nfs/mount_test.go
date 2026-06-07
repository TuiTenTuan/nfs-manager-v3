package nfs

import (
	"strings"
	"testing"
)

func TestRenderMountConfigRsizeWsize(t *testing.T) {
	base := MountClientOptions{
		MountPoint: "/mnt/nfs/data",
		Version:    "4.1",
		NFSVers:    "4.1",
		Hard:       true,
	}

	t.Run("default includes rsize and wsize", func(t *testing.T) {
		result, err := RenderMountConfig("192.168.1.10", "/srv/nfs/data", base)
		if err != nil {
			t.Fatal(err)
		}
		if !strings.Contains(result.OptionsString, "rsize=1048576") {
			t.Fatalf("expected rsize default, got %q", result.OptionsString)
		}
		if !strings.Contains(result.OptionsString, "wsize=1048576") {
			t.Fatalf("expected wsize default, got %q", result.OptionsString)
		}
	})

	t.Run("zero rsize omitted", func(t *testing.T) {
		zero := 0
		opts := base
		opts.Rsize = &zero
		result, err := RenderMountConfig("192.168.1.10", "/srv/nfs/data", opts)
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(result.OptionsString, "rsize=") {
			t.Fatalf("expected rsize omitted, got %q", result.OptionsString)
		}
		if !strings.Contains(result.OptionsString, "wsize=1048576") {
			t.Fatalf("expected wsize default, got %q", result.OptionsString)
		}
	})

	t.Run("zero wsize omitted", func(t *testing.T) {
		zero := 0
		opts := base
		opts.Wsize = &zero
		result, err := RenderMountConfig("192.168.1.10", "/srv/nfs/data", opts)
		if err != nil {
			t.Fatal(err)
		}
		if !strings.Contains(result.OptionsString, "rsize=1048576") {
			t.Fatalf("expected rsize default, got %q", result.OptionsString)
		}
		if strings.Contains(result.OptionsString, "wsize=") {
			t.Fatalf("expected wsize omitted, got %q", result.OptionsString)
		}
	})

	t.Run("zero rsize and wsize omitted", func(t *testing.T) {
		zero := 0
		opts := base
		opts.Rsize = &zero
		opts.Wsize = &zero
		result, err := RenderMountConfig("192.168.1.10", "/srv/nfs/data", opts)
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(result.OptionsString, "rsize=") || strings.Contains(result.OptionsString, "wsize=") {
			t.Fatalf("expected both omitted, got %q", result.OptionsString)
		}
	})
}
