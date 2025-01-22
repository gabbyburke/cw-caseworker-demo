use strict;
use warnings;
use v5.30;

use File::Slurp;
use JSON;

# NOTE: run from tmp/ directory

open my $out, '>', '../data/case_notes.csv';
say $out join( ", ", map { qq{"$_"} } qw( case_id visit_id visit_date note ) );

foreach my $filename ( <../data/*.json> ) {
    my $file_contents = read_file( $filename ) =~ s/\x{ef}\x{bb}\x{bf}//r;
    my $data = from_json( $file_contents ) or die "$!\n";

    foreach my $rec ( $data->@* ) {
        say $out join( ", ", map { qq{"$rec->{$_}"} } ( "Case ID", "Visit ID", "Visit Date", "Case Note" ) );
    }
}

close $out;