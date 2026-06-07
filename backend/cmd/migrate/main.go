package main

import (
	"fmt"
	"log"
	"os"

	"github.com/nfs-manager/nfs-manager-v3/backend/internal/config"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/db"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	cmd := "up"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}
	switch cmd {
	case "up":
		if err := db.MigrateUp(cfg.Database); err != nil {
			log.Fatal(err)
		}
		fmt.Println("migrations applied")
	case "down":
		if err := db.MigrateDown(cfg.Database); err != nil {
			log.Fatal(err)
		}
		fmt.Println("migrations rolled back")
	default:
		log.Fatal("usage: migrate [up|down]")
	}
}
