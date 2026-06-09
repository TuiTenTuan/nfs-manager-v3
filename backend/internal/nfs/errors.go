package nfs

import (
	"errors"
	"fmt"
	"strings"
)

type ReloadError struct {
	ExitCode int
	Stderr   string
	Err      error
}

func (e *ReloadError) Error() string {
	stderr := strings.TrimSpace(e.Stderr)
	if stderr != "" {
		return fmt.Sprintf("exportfs failed (exit %d): %s", e.ExitCode, stderr)
	}
	if e.Err != nil {
		return fmt.Sprintf("exportfs failed (exit %d): %v", e.ExitCode, e.Err)
	}
	return fmt.Sprintf("exportfs failed (exit %d)", e.ExitCode)
}

func (e *ReloadError) Unwrap() error { return e.Err }

func AsReloadError(err error) *ReloadError {
	var re *ReloadError
	if errors.As(err, &re) {
		return re
	}
	return nil
}
